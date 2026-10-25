import { crc32, deflateRawSync } from 'node:zlib';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Planilha .xlsx de uma aba, sem dependência: o XML mínimo do OpenXML zipado à mão.
 * Textos viram inlineStr (nunca são interpretados como fórmula); números ficam numéricos.
 */
export function gerarXlsx(aba: string, linhas: (string | number)[][]): Buffer {
  const celulas = linhas.map((linha, i) =>
    `<row r="${i + 1}">${linha.map(celula).join('')}</row>`,
  );
  return zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${xml(aba.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<sheetData>${celulas.join('')}</sheetData></worksheet>`,
  });
}

function celula(valor: string | number): string {
  return typeof valor === 'number'
    ? `<c><v>${valor}</v></c>`
    : `<c t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}

/** Escapa &, <, > e " e remove caracteres de controle que o XML não aceita. */
function xml(texto: string): string {
  return texto
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ZIP com deflate (cabeçalhos locais + diretório central + fim), suficiente para o .xlsx acima. */
function zip(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const nomeBuf = Buffer.from(nome);
    const dados = Buffer.from(conteudo);
    const comprimido = deflateRawSync(dados);
    const comum = Buffer.alloc(26);
    comum.writeUInt16LE(20, 0); // versão mínima
    comum.writeUInt16LE(0x0800, 2); // nomes em UTF-8
    comum.writeUInt16LE(8, 4); // deflate
    comum.writeUInt32LE(0x00210000, 6); // data/hora DOS fixa (01/01/1980)
    comum.writeUInt32LE(crc32(dados), 10);
    comum.writeUInt32LE(comprimido.length, 14);
    comum.writeUInt32LE(dados.length, 18);
    comum.writeUInt16LE(nomeBuf.length, 22);
    const local = Buffer.concat([u32(0x04034b50), comum, nomeBuf, comprimido]);
    const fimCentral = Buffer.alloc(14); // comentário, disco, atributos e deslocamento
    fimCentral.writeUInt32LE(deslocamento, 10);
    central.push(Buffer.concat([u32(0x02014b50), Buffer.from([20, 0]), comum, fimCentral, nomeBuf]));
    locais.push(local);
    deslocamento += local.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(central.length, 8);
  fim.writeUInt16LE(central.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

function u32(valor: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(valor);
  return buf;
}
