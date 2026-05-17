import JSZip from 'jszip';

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function getElementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.querySelectorAll('*')).filter((node) => node.localName === localName);
}

function getDirectChildByLocalName(parent: Element, localName: string): Element | null {
  return Array.from(parent.children).find((node) => node.localName === localName) ?? null;
}

function getCellTextContent(node: Element): string {
  return getElementsByLocalName(node, 't')
    .map((textNode) => textNode.textContent ?? '')
    .join('');
}

function columnRefToIndex(cellRef: string): number {
  const letters = cellRef.replace(/\d+/g, '').toUpperCase();
  let index = 0;

  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

function normalizeZipPath(target: string | null | undefined): string {
  if (!target) return 'xl/worksheets/sheet1.xml';

  const cleaned = target
    .replace(/^\/+/, '')
    .replace(/^xl\//, '')
    .replace(/^\.\.\//, '');

  return cleaned.startsWith('xl/') ? cleaned : `xl/${cleaned}`;
}

async function resolveFirstWorksheetPath(zip: JSZip): Promise<string> {
  const workbookFile = zip.file('xl/workbook.xml');
  const workbookRelsFile = zip.file('xl/_rels/workbook.xml.rels');

  if (!workbookFile || !workbookRelsFile) {
    return 'xl/worksheets/sheet1.xml';
  }

  const [workbookXml, workbookRelsXml] = await Promise.all([
    workbookFile.async('text'),
    workbookRelsFile.async('text'),
  ]);

  const workbookDoc = parseXml(workbookXml);
  const workbookRelsDoc = parseXml(workbookRelsXml);
  const firstSheet = getElementsByLocalName(workbookDoc, 'sheet')[0];
  const relationshipId =
    firstSheet?.getAttribute('r:id') ??
    firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');

  if (!relationshipId) {
    return 'xl/worksheets/sheet1.xml';
  }

  const relationship = getElementsByLocalName(workbookRelsDoc, 'Relationship').find(
    (node) => node.getAttribute('Id') === relationshipId,
  );

  return normalizeZipPath(relationship?.getAttribute('Target'));
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];

  const doc = parseXml(xml);
  return getElementsByLocalName(doc, 'si').map((item) => getCellTextContent(item));
}

function parseCellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t');

  if (type === 'inlineStr') {
    const inlineString = getDirectChildByLocalName(cell, 'is');
    return inlineString ? getCellTextContent(inlineString) : '';
  }

  if (type === 'str') {
    return getDirectChildByLocalName(cell, 'v')?.textContent?.trim() ?? '';
  }

  if (type === 's') {
    const sharedStringIndex = Number(getDirectChildByLocalName(cell, 'v')?.textContent ?? -1);
    return sharedStrings[sharedStringIndex] ?? '';
  }

  if (type === 'b') {
    return getDirectChildByLocalName(cell, 'v')?.textContent === '1' ? 'TRUE' : 'FALSE';
  }

  return getDirectChildByLocalName(cell, 'v')?.textContent?.trim() ?? getCellTextContent(cell);
}

export async function parseXlsxFirstWorksheetRows(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const zip = await JSZip.loadAsync(buffer);
  const worksheetPath = await resolveFirstWorksheetPath(zip);
  const worksheetFile = zip.file(worksheetPath);

  if (!worksheetFile) {
    return [];
  }

  const [worksheetXml, sharedStringsXml] = await Promise.all([
    worksheetFile.async('text'),
    zip.file('xl/sharedStrings.xml')?.async('text') ?? Promise.resolve(null),
  ]);

  const worksheetDoc = parseXml(worksheetXml);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = getElementsByLocalName(worksheetDoc, 'row');

  if (rows.length === 0) {
    return [];
  }

  const headers: string[] = [];
  const firstRowCells = getElementsByLocalName(rows[0], 'c');
  firstRowCells.forEach((cell) => {
    const cellRef = cell.getAttribute('r');
    if (!cellRef) return;
    headers[columnRefToIndex(cellRef)] = parseCellValue(cell, sharedStrings).trim();
  });

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};

    getElementsByLocalName(row, 'c').forEach((cell) => {
      const cellRef = cell.getAttribute('r');
      if (!cellRef) return;

      const header = headers[columnRefToIndex(cellRef)];
      if (!header) return;

      record[header] = parseCellValue(cell, sharedStrings);
    });

    return record;
  });
}