/**
 * Extracts embedded images from XLSX files by treating them as ZIP archives.
 * Maps images to specific rows/columns via the drawing XML anchors.
 */
import JSZip from 'jszip';

export interface ExtractedImage {
  base64: string;
  mimeType: string;
}

/** Column index (0-based) for "Imagem do Enunciado" and "Imagem do Comentário" */
const ENUNCIADO_IMAGE_COL = 5;  // Column F
const COMENTARIO_IMAGE_COL = 12; // Column M

/**
 * Extract embedded images from an XLSX ArrayBuffer.
 * Returns two maps: enunciadoImages and comentarioImages, keyed by row number (0-based data row).
 */
export async function extractImagesFromXlsx(buffer: ArrayBuffer): Promise<{
  enunciadoImages: Map<number, ExtractedImage>;
  comentarioImages: Map<number, ExtractedImage>;
}> {
  const enunciadoImages = new Map<number, ExtractedImage>();
  const comentarioImages = new Map<number, ExtractedImage>();

  try {
    const zip = await JSZip.loadAsync(buffer);

    // 1. Collect all media files
    const mediaFiles = new Map<string, JSZip.JSZipObject>();
    zip.forEach((path, file) => {
      if (path.startsWith('xl/media/') && !file.dir) {
        mediaFiles.set(path, file);
      }
    });

    if (mediaFiles.size === 0) return { enunciadoImages, comentarioImages };

    // 2. Parse worksheet rels to find drawing relationships
    const sheetRelsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
    const sheetRelsFile = zip.file(sheetRelsPath);
    if (!sheetRelsFile) return { enunciadoImages, comentarioImages };

    const sheetRelsXml = await sheetRelsFile.async('text');
    const drawingMatch = sheetRelsXml.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/);
    if (!drawingMatch) return { enunciadoImages, comentarioImages };

    const drawingPath = `xl/drawings/${drawingMatch[1]}`;
    const drawingFile = zip.file(drawingPath);
    if (!drawingFile) return { enunciadoImages, comentarioImages };

    // 3. Parse drawing rels to map rId -> media file
    const drawingRelsPath = `xl/drawings/_rels/${drawingMatch[1]}.rels`;
    const drawingRelsFile = zip.file(drawingRelsPath);
    if (!drawingRelsFile) return { enunciadoImages, comentarioImages };

    const drawingRelsXml = await drawingRelsFile.async('text');
    const rIdToMedia = new Map<string, string>();
    const relRegex = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g;
    let relMatch;
    while ((relMatch = relRegex.exec(drawingRelsXml)) !== null) {
      rIdToMedia.set(relMatch[1], `xl/media/${relMatch[2]}`);
    }

    // 4. Parse drawing XML to get anchor positions
    const drawingXml = await drawingFile.async('text');

    // Match twoCellAnchor or oneCellAnchor blocks
    const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
    let anchorMatch;

    while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
      const block = anchorMatch[1];

      // Get the "from" position (row and col)
      const fromRowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
      const fromColMatch = block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);

      if (!fromRowMatch || !fromColMatch) continue;

      const row = parseInt(fromRowMatch[1], 10);
      const col = parseInt(fromColMatch[1], 10);

      // Get the rId reference (blip)
      const blipMatch = block.match(/r:embed="(rId\d+)"/);
      if (!blipMatch) continue;

      const rId = blipMatch[1];
      const mediaPath = rIdToMedia.get(rId);
      if (!mediaPath) continue;

      const mediaFile = mediaFiles.get(mediaPath);
      if (!mediaFile) continue;

      // Convert to base64
      const imageData = await mediaFile.async('base64');
      const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/png';

      const image: ExtractedImage = { base64: imageData, mimeType };

      // Row 0 is typically the header row, data starts at row 1
      // Subtract 1 to get 0-based data row index
      const dataRow = row - 1;
      if (dataRow < 0) continue;

      if (col === ENUNCIADO_IMAGE_COL) {
        enunciadoImages.set(dataRow, image);
      } else if (col === COMENTARIO_IMAGE_COL) {
        comentarioImages.set(dataRow, image);
      }
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
