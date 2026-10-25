import { BadRequestException } from '@nestjs/common';

// Caminho de um campo dentro do dado lido pela IA, como a revisão envia no PATCH:
// "paciente.nomeMae", "transfusoes[1].volMl", "pesquisas[0].fenotipagem[2].resultado".

type Parte = string | number;

const FORMATO = /^[A-Za-z]+(\[\d+\]|\.[A-Za-z]+)*$/;

export function partesDoCaminho(campo: string): Parte[] {
  if (!FORMATO.test(campo)) {
    throw new BadRequestException(
      `Campo "${campo}" inválido. Use o formato "paciente.nomeMae" ou "transfusoes[1].volMl".`,
    );
  }
  return campo
    .split(/[.[\]]+/)
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

export function lerCaminho(raiz: unknown, partes: Parte[]): unknown {
  return partes.reduce<unknown>(
    (atual, p) =>
      atual !== null && typeof atual === 'object'
        ? (atual as Record<Parte, unknown>)[p]
        : undefined,
    raiz,
  );
}

/**
 * Grava `valor` no caminho, alterando `raiz`. Só altera campos que já existem; numa lista,
 * o índice igual ao tamanho acrescenta um item novo e `null` num item remove esse item.
 */
export function gravarCaminho(raiz: unknown, partes: Parte[], valor: unknown): void {
  const pai = lerCaminho(raiz, partes.slice(0, -1));
  const ultima = partes[partes.length - 1];
  const campo = partes.join('.');

  if (typeof ultima === 'number') {
    if (!Array.isArray(pai) || ultima > pai.length) {
      throw new BadRequestException(`Item "${campo}" não existe.`);
    }
    if (valor === null) pai.splice(ultima, 1);
    else pai[ultima] = valor;
    return;
  }

  if (pai === null || typeof pai !== 'object' || Array.isArray(pai) || !Object.hasOwn(pai, ultima)) {
    throw new BadRequestException(`Campo "${campo}" não existe na ficha.`);
  }
  (pai as Record<string, unknown>)[ultima] = valor;
}
