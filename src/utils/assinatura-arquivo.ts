// Confere o conteúdo do arquivo enviado: o tipo declarado vem do navegador e não é confiável.

/** Uma foto de celular de 48 MP passa; acima disso a imagem descompactada pesa centenas de MB. */
export const MAXIMO_PIXELS = 60_000_000;

const ASSINATURAS: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

/** Largura e altura gravadas no cabeçalho, sem descompactar a imagem. */
function dimensoes(buffer: Buffer, mimeType: string): [number, number] | null {
  if (mimeType === 'image/png') {
    return buffer.length >= 24 ? [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] : null;
  }
  // JPEG: percorre os segmentos até o SOFn (C0 a CF, menos C4, C8 e CC)
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marcador = buffer[i + 1];
    if (marcador === 0xff) {
      i++;
      continue;
    }
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return [buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5)];
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}

/** Devolve o motivo da recusa, ou null se o conteúdo bate com o tipo declarado. */
export function problemaNoArquivo(buffer: Buffer, mimeType: string): string | null {
  const assinatura = Object.hasOwn(ASSINATURAS, mimeType) ? ASSINATURAS[mimeType] : null;
  if (!assinatura || !assinatura.every((byte, i) => buffer[i] === byte)) {
    return 'o conteúdo não é um PDF, JPEG ou PNG de verdade';
  }
  if (mimeType === 'application/pdf') return null;
  const tamanho = dimensoes(buffer, mimeType);
  if (!tamanho) return 'a imagem está corrompida';
  const [largura, altura] = tamanho;
  if (!largura || !altura || largura * altura > MAXIMO_PIXELS) {
    return `a imagem tem ${largura} × ${altura} pixels; o máximo é ${MAXIMO_PIXELS / 1_000_000} megapixels`;
  }
  return null;
}
