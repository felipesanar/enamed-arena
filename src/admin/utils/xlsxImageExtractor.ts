/**
 * Extracts embedded images from XLSX files by treating them as ZIP archives.
 * Maps images to specific rows/columns via the drawing XML anchors.
 */
import JSZip from 'jszip';
import { logger } from '@/lib/logger';

export interface ExtractedImage {
  base64: string;
  mimeType: string;
}

export type ImageSlot = 'enunciado' | 'enunciado2' | 'comentario';

export interface ImageColumns {
  enunciadoCol: number;
  enunciado2Col: number;
  comentarioCol: number;
}

/** Aliases normalizados (sem acento, minúsculo) por slot. */
const IMAGE_HEADER_ALIASES: Record<ImageSlot, string[]> = {
  enunciado: ['imagem do enunciado', 'imagem enunciado', 'imagem'],
  enunciado2: ['imagem 2 do enunciado', 'imagem 2 enunciado', 'imagem 2', 'img 2', 'imagem secundaria', 'segunda imagem'],
  comentario: ['imagem do comentario', 'imagem comentario', 'imagem do comentário'],
};

/** Decide o slot de uma imagem a partir do índice de coluna. Estrito: sem tolerância ±1. */
export function slotForColumn(col: number, cols: ImageColumns): ImageSlot | null {
  if (cols.enunciado2Col >= 0 && col === cols.enunciado2Col) return 'enunciado2';
  if (cols.enunciadoCol >= 0 && col === cols.enunciadoCol) return 'enunciado';
  if (cols.comentarioCol >= 0 && col === cols.comentarioCol) return 'comentario';
  return null;
}

/** Casa o texto de um header de coluna com um slot, via aliases normalizados. */
export function slotForHeader(headerText: string): ImageSlot | null {
  const n = normalize(headerText);
  // ordem importa: 'imagem 2' antes de 'imagem' pra não ser engolido
  for (const slot of ['enunciado2', 'comentario', 'enunciado'] as ImageSlot[]) {
    if (IMAGE_HEADER_ALIASES[slot].some((a) => n === a)) return slot;
  }
  return null;
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function colRefToIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '').toUpperCase();
  let i = 0;
  for (const c of letters) i = i * 26 + (c.charCodeAt(0) - 64);
  return i - 1;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeZipPath(target: string | null | undefined): string {
  if (!target) return '';

  const cleaned = target
    .replace(/^\/+/, '')
    .replace(/^\.\.\//, '')
    .replace(/^xl\//, '');

  return cleaned ? `xl/${cleaned}` : '';
}

function getElementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter((node) => node.localName === localName) as Element[];
}

function buildWorksheetRowIndexMap(worksheetXml: string): Map<number, number> {
  const doc = parseXml(worksheetXml);
  const rows = getElementsByLocalName(doc, 'row');
  const rowIndexMap = new Map<number, number>();

  rows.slice(1).forEach((row, dataIndex) => {
    const excelRowNumber = Number(row.getAttribute('r') ?? dataIndex + 2);
    rowIndexMap.set(excelRowNumber, dataIndex);
  });

  return rowIndexMap;
}

async function getSharedStrings(zip: JSZip): Promise<string[]> {
  const f = zip.file('xl/sharedStrings.xml');
  if (!f) return [];
  const doc = parseXml(await f.async('text'));
  return Array.from(doc.getElementsByTagName('*'))
    .filter((n) => n.localName === 'si')
    .map((si) =>
      Array.from(si.getElementsByTagName('*'))
        .filter((n) => n.localName === 't')
        .map((t) => t.textContent ?? '')
        .join(''),
    );
}

/** Read header row from a worksheet XML and return ImageColumns (3 slots). */
function findImageColumns(
  worksheetXml: string,
  sharedStrings: string[],
): ImageColumns {
  const doc = parseXml(worksheetXml);
  const rows = Array.from(doc.getElementsByTagName('*')).filter((n) => n.localName === 'row');
  if (rows.length === 0) return { enunciadoCol: -1, enunciado2Col: -1, comentarioCol: -1 };

  let enunciadoCol = -1;
  let enunciado2Col = -1;
  let comentarioCol = -1;

  const firstRow = rows[0];
  const cells = Array.from(firstRow.children).filter((n) => n.localName === 'c');
  for (const cell of cells) {
    const ref = cell.getAttribute('r');
    if (!ref) continue;
    const colIdx = colRefToIndex(ref);
    const type = cell.getAttribute('t');
    let value = '';
    if (type === 's') {
      const v = Array.from(cell.children).find((n) => n.localName === 'v')?.textContent ?? '';
      value = sharedStrings[Number(v)] ?? '';
    } else if (type === 'inlineStr') {
      const is = Array.from(cell.children).find((n) => n.localName === 'is');
      if (is) {
        value = Array.from(is.getElementsByTagName('*'))
          .filter((n) => n.localName === 't')
          .map((t) => t.textContent ?? '')
          .join('');
      }
    } else {
      value = Array.from(cell.children).find((n) => n.localName === 'v')?.textContent ?? '';
    }
    const slot = slotForHeader(value);
    if (slot === 'enunciado') enunciadoCol = colIdx;
    else if (slot === 'enunciado2') enunciado2Col = colIdx;
    else if (slot === 'comentario') comentarioCol = colIdx;
  }

  return { enunciadoCol, enunciado2Col, comentarioCol };
}

/**
 * Extract embedded images from an XLSX ArrayBuffer.
 * Returns three maps keyed by 0-based data row index.
 */
export async function extractImagesFromXlsx(buffer: ArrayBuffer): Promise<{
  enunciadoImages: Map<number, ExtractedImage>;
  enunciado2Images: Map<number, ExtractedImage>;
  comentarioImages: Map<number, ExtractedImage>;
}> {
  const enunciadoImages = new Map<number, ExtractedImage>();
  const enunciado2Images = new Map<number, ExtractedImage>();
  const comentarioImages = new Map<number, ExtractedImage>();

  try {
    const zip = await JSZip.loadAsync(buffer);

    // Collect media files
    const mediaFiles = new Map<string, JSZip.JSZipObject>();
    zip.forEach((path, file) => {
      if (path.startsWith('xl/media/') && !file.dir) {
        mediaFiles.set(path, file);
      }
    });
    if (mediaFiles.size === 0) return { enunciadoImages, enunciado2Images, comentarioImages };

    const sharedStrings = await getSharedStrings(zip);

    // Find all worksheet files
    const worksheetPaths: string[] = [];
    zip.forEach((path, file) => {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path) && !file.dir) {
        worksheetPaths.push(path);
      }
    });

    for (const wsPath of worksheetPaths) {
      const wsFile = zip.file(wsPath);
      if (!wsFile) continue;
      const wsXml = await wsFile.async('text');

      const { enunciadoCol, enunciado2Col, comentarioCol } = findImageColumns(wsXml, sharedStrings);
      if (enunciadoCol < 0 && enunciado2Col < 0 && comentarioCol < 0) continue;

      const rowIndexMap = buildWorksheetRowIndexMap(wsXml);

      // Locate sheet rels
      const wsName = wsPath.split('/').pop()!;
      const relsPath = `xl/worksheets/_rels/${wsName}.rels`;
      const relsFile = zip.file(relsPath);
      if (!relsFile) continue;
      const relsXml = await relsFile.async('text');
      const drawingRelationship = getElementsByLocalName(parseXml(relsXml), 'Relationship').find((node) =>
        node.getAttribute('Type')?.includes('/drawing'),
      );
      const drawingPath = normalizeZipPath(drawingRelationship?.getAttribute('Target'));
      if (!drawingPath) continue;

      const drawingFileName = drawingPath.split('/').pop()!;
      const drawingFile = zip.file(drawingPath);
      if (!drawingFile) continue;

      const drawingRelsPath = `xl/drawings/_rels/${drawingFileName}.rels`;
      const drawingRelsFile = zip.file(drawingRelsPath);
      if (!drawingRelsFile) continue;
      const drawingRelsXml = await drawingRelsFile.async('text');

      const rIdToMedia = new Map<string, string>();
      getElementsByLocalName(parseXml(drawingRelsXml), 'Relationship').forEach((node) => {
        const id = node.getAttribute('Id');
        const mediaPath = normalizeZipPath(node.getAttribute('Target'));
        if (id && mediaPath) rIdToMedia.set(id, mediaPath);
      });

      const drawingXml = await drawingFile.async('text');
      // Drawings may use the xdr: prefix OR be unprefixed depending on the writer
      const anchorRegex = /<(?:xdr:)?(twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?\1>/g;
      let anchorMatch;
      const anchorDebug: Array<{ row: number; col: number; hasBlip: boolean }> = [];

      while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
        const block = anchorMatch[2];
        const fromBlock = block.match(/<(?:xdr:)?from>([\s\S]*?)<\/(?:xdr:)?from>/);
        if (!fromBlock) continue;
        const fromRowMatch = fromBlock[1].match(/<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/);
        const fromColMatch = fromBlock[1].match(/<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col>/);
        if (!fromRowMatch || !fromColMatch) continue;

        const row = parseInt(fromRowMatch[1], 10);
        const col = parseInt(fromColMatch[1], 10);

        // Embed attribute may use r: prefix or default ns
        const blipMatch = block.match(/(?:r:)?embed="(rId\d+)"/);
        anchorDebug.push({ row, col, hasBlip: !!blipMatch });
        if (!blipMatch) continue;
        const mediaPath = rIdToMedia.get(blipMatch[1]);
        if (!mediaPath) continue;
        const mediaFile = mediaFiles.get(mediaPath);
        if (!mediaFile) continue;

        const imageData = await mediaFile.async('base64');
        const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType =
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'png' ? 'image/png'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : 'image/png';

        const image: ExtractedImage = { base64: imageData, mimeType };
        const excelRowNumber = row + 1;
        const dataRow = rowIndexMap.get(excelRowNumber);
        if (dataRow === undefined) continue;

        const slot = slotForColumn(col, { enunciadoCol, enunciado2Col, comentarioCol });
        if (slot === 'enunciado') enunciadoImages.set(dataRow, image);
        else if (slot === 'enunciado2') enunciado2Images.set(dataRow, image);
        else if (slot === 'comentario') comentarioImages.set(dataRow, image);
        // sem slot reconhecido: ignora (não chuta vizinho)
      }

      logger.info('[xlsxImageExtractor]', {
        worksheet: wsPath,
        enunciadoCol,
        enunciado2Col,
        comentarioCol,
        enunciadoFound: enunciadoImages.size,
        enunciado2Found: enunciado2Images.size,
        comentarioFound: comentarioImages.size,
        drawingPath,
        anchorsCount: anchorDebug.length,
        anchorsSample: anchorDebug.slice(0, 5),
        drawingXmlHead: drawingXml.slice(0, 400),
      });
    }
  } catch (err) {
    logger.error('[xlsxImageExtractor] Error extracting images:', err);
  }

  return { enunciadoImages, enunciado2Images, comentarioImages };
}

/**
 * Get MIME type extension for storage path
 */
export function mimeToExt(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}
