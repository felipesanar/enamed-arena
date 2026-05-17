/**
 * Extracts embedded images from XLSX files by treating them as ZIP archives.
 * Maps images to specific rows/columns via the drawing XML anchors.
 */
import JSZip from 'jszip';

export interface ExtractedImage {
  base64: string;
  mimeType: string;
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

/** Read header row from a worksheet XML and return { enunciadoCol, comentarioCol } */
function findImageColumns(
  worksheetXml: string,
  sharedStrings: string[],
): { enunciadoCol: number; comentarioCol: number } {
  const doc = parseXml(worksheetXml);
  const rows = Array.from(doc.getElementsByTagName('*')).filter((n) => n.localName === 'row');
  if (rows.length === 0) return { enunciadoCol: -1, comentarioCol: -1 };

  let enunciadoCol = -1;
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
    const n = normalize(value);
    if (n === 'imagem do enunciado') enunciadoCol = colIdx;
    else if (n === 'imagem do comentario') comentarioCol = colIdx;
  }

  return { enunciadoCol, comentarioCol };
}

/**
 * Extract embedded images from an XLSX ArrayBuffer.
 * Returns two maps keyed by 0-based data row index.
 */
export async function extractImagesFromXlsx(buffer: ArrayBuffer): Promise<{
  enunciadoImages: Map<number, ExtractedImage>;
  comentarioImages: Map<number, ExtractedImage>;
}> {
  const enunciadoImages = new Map<number, ExtractedImage>();
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
    if (mediaFiles.size === 0) return { enunciadoImages, comentarioImages };

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

      const { enunciadoCol, comentarioCol } = findImageColumns(wsXml, sharedStrings);
      if (enunciadoCol < 0 && comentarioCol < 0) continue;

      // Locate sheet rels
      const wsName = wsPath.split('/').pop()!;
      const relsPath = `xl/worksheets/_rels/${wsName}.rels`;
      const relsFile = zip.file(relsPath);
      if (!relsFile) continue;
      const relsXml = await relsFile.async('text');
      const drawingMatch = relsXml.match(/Target="[^"]*drawings\/(drawing\d+\.xml)"/);
      if (!drawingMatch) continue;

      const drawingFileName = drawingMatch[1];
      const drawingPath = `xl/drawings/${drawingFileName}`;
      const drawingFile = zip.file(drawingPath);
      if (!drawingFile) continue;

      const drawingRelsPath = `xl/drawings/_rels/${drawingFileName}.rels`;
      const drawingRelsFile = zip.file(drawingRelsPath);
      if (!drawingRelsFile) continue;
      const drawingRelsXml = await drawingRelsFile.async('text');

      const rIdToMedia = new Map<string, string>();
      const relRegex = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
      let relMatch;
      while ((relMatch = relRegex.exec(drawingRelsXml)) !== null) {
        const target = relMatch[2].replace(/^\.\.\//, '');
        const mediaPath = target.startsWith('xl/') ? target : `xl/${target}`;
        rIdToMedia.set(relMatch[1], mediaPath);
      }

      const drawingXml = await drawingFile.async('text');
      const anchorRegex = /<xdr:(twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:\1>/g;
      let anchorMatch;
      const anchorDebug: Array<{ row: number; col: number; hasBlip: boolean }> = [];

      while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
        const block = anchorMatch[2];
        const fromRowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const fromColMatch = block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
        if (!fromRowMatch || !fromColMatch) continue;

        const row = parseInt(fromRowMatch[1], 10);
        const col = parseInt(fromColMatch[1], 10);

        const blipMatch = block.match(/r:embed="(rId\d+)"/);
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
        const dataRow = row - 1; // header is row 0
        if (dataRow < 0) continue;

        if (enunciadoCol >= 0 && col === enunciadoCol) {
          enunciadoImages.set(dataRow, image);
        } else if (comentarioCol >= 0 && col === comentarioCol) {
          comentarioImages.set(dataRow, image);
        } else {
          // Fallback: if image is near a known image column, accept it
          if (enunciadoCol >= 0 && Math.abs(col - enunciadoCol) <= 1) {
            enunciadoImages.set(dataRow, image);
          } else if (comentarioCol >= 0 && Math.abs(col - comentarioCol) <= 1) {
            comentarioImages.set(dataRow, image);
          }
        }
      }

      console.info('[xlsxImageExtractor]', {
        worksheet: wsPath,
        enunciadoCol,
        comentarioCol,
        enunciadoFound: enunciadoImages.size,
        comentarioFound: comentarioImages.size,
        drawingPath,
        anchorsCount: anchorDebug.length,
        anchorsSample: anchorDebug.slice(0, 5),
        drawingXmlHead: drawingXml.slice(0, 400),
      });
    }
  } catch (err) {
    console.error('[xlsxImageExtractor] Error extracting images:', err);
  }

  return { enunciadoImages, comentarioImages };
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
