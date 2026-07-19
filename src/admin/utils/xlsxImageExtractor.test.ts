import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { slotForColumn, slotForHeader, extractImagesFromXlsx } from './xlsxImageExtractor';

describe('slotForHeader', () => {
  it('reconhece imagem do enunciado', () => {
    expect(slotForHeader('Imagem do Enunciado')).toBe('enunciado');
  });
  it('reconhece imagem 2 do enunciado e não confunde com enunciado', () => {
    expect(slotForHeader('Imagem 2 do Enunciado')).toBe('enunciado2');
    expect(slotForHeader('Imagem 2')).toBe('enunciado2');
  });
  it('reconhece imagem do comentário com acento', () => {
    expect(slotForHeader('Imagem do Comentário')).toBe('comentario');
  });
  it('retorna null pra header desconhecido', () => {
    expect(slotForHeader('Enunciado')).toBeNull();
  });
});

describe('slotForColumn (estrito, sem ±1)', () => {
  const cols = { enunciadoCol: 5, enunciado2Col: 6, comentarioCol: 11 };
  it('mapeia cada coluna ao seu slot', () => {
    expect(slotForColumn(5, cols)).toBe('enunciado');
    expect(slotForColumn(6, cols)).toBe('enunciado2');
    expect(slotForColumn(11, cols)).toBe('comentario');
  });
  it('NÃO vaza coluna vizinha pro slot errado', () => {
    expect(slotForColumn(7, cols)).toBeNull();
    expect(slotForColumn(4, cols)).toBeNull();
  });
});

/**
 * Monta um XLSX mínimo em memória (via JSZip) com duas imagens ancoradas na
 * MESMA célula/linha (coluna F, linha de dados 0), empilhadas verticalmente
 * (rowOff diferentes). Reproduz a planilha real de upload de questões, onde
 * duas "tabelas" de imagem caem na mesma coluna "Imagem do enunciado".
 */
async function buildXlsxWithStackedImages(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">
  <si><t>Imagem do enunciado</t></si>
</sst>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="F1" t="s"><v>0</v></c>
    </row>
    <row r="2"></row>
  </sheetData>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`,
  );

  // Duas imagens ancoradas em <xdr:from><xdr:col>5</xdr:col><xdr:row>1</xdr:row>
  // (coluna F = índice 5, linha Excel 2 = linha de dados 0), com rowOff
  // diferentes simulando o empilhamento vertical na mesma célula.
  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>100000</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill>
      <xdr:spPr/>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>2000000</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:blipFill><a:blip r:embed="rId2"/></xdr:blipFill>
      <xdr:spPr/>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  );

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.png"/>
</Relationships>`,
  );

  // Bytes distintos pra cada imagem (não precisam ser PNG válido: o teste
  // não decodifica, só compara base64 bruto).
  zip.file('xl/media/image1.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 1, 1, 1]));
  zip.file('xl/media/image2.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 2, 2, 2, 2]));

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('extractImagesFromXlsx — colisão de 2+ imagens na mesma célula/linha', () => {
  it('não sobrescreve: mantém 1 imagem por linha (stitch) e preserva a de menor rowOff (topo) no fallback sem canvas', async () => {
    const buffer = await buildXlsxWithStackedImages();
    const { enunciadoImages, enunciado2Images, comentarioImages } = await extractImagesFromXlsx(buffer);

    // Contrato: continua 1 imagem por slot/linha, nunca um array.
    expect(enunciadoImages.size).toBe(1);
    expect(enunciado2Images.size).toBe(0);
    expect(comentarioImages.size).toBe(0);

    const result = enunciadoImages.get(0);
    expect(result).toBeDefined();

    // image1 tem rowOff menor (100000 < 2000000) → é a de cima → deve
    // "vencer" o stitch (em jsdom, sem canvas, o fallback devolve a 1ª da
    // lista ordenada, ou seja, a do topo). Isso prova que a 2ª imagem
    // (antes sobrescrevia via Map.set) não apagou a 1ª, e que a ordem é
    // topo-primeiro.
    const expectedBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 1, 1, 1]).toString('base64');
    expect(result!.base64).toBe(expectedBase64);
    expect(result!.mimeType).toBe('image/png');
  });
});
