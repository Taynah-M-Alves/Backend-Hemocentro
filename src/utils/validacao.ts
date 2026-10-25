import { BadRequestException } from '@nestjs/common';
import { dataIso } from './ficha-sanitize.js';

// Conferência do que chega no body e na query. Erro aqui vira 400 com a mensagem.

export type Corpo = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function corpo(v: unknown): Corpo {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new BadRequestException('O body precisa ser um objeto JSON.');
  }
  return v as Corpo;
}

export function textoObrigatorio(c: Corpo, campo: string, max = 255): string {
  const valor = textoOpcional(c, campo, max);
  if (!valor) throw new BadRequestException(`"${campo}" é obrigatório.`);
  return valor;
}

export function textoOpcional(
  c: Corpo,
  campo: string,
  max = 255,
): string | undefined {
  const valor = c[campo];
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'string') {
    throw new BadRequestException(`"${campo}" precisa ser texto.`);
  }
  const limpo = valor.trim();
  if (limpo.length > max) {
    throw new BadRequestException(
      `"${campo}" pode ter no máximo ${max} caracteres.`,
    );
  }
  return limpo || undefined;
}

/** `null` é aceito de propósito (ex.: desligar a colaboradora do usuário). */
export function idOpcional(c: Corpo, campo: string): number | null | undefined {
  const valor = c[campo];
  if (valor === undefined || valor === null) return valor;
  return idValido(valor, campo);
}

export function booleanoOpcional(c: Corpo, campo: string): boolean | undefined {
  const valor = c[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'boolean') {
    throw new BadRequestException(`"${campo}" precisa ser true ou false.`);
  }
  return valor;
}

export function uuidOpcional(c: Corpo, campo: string): string | undefined {
  const valor = c[campo];
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'string' || !UUID.test(valor)) {
    throw new BadRequestException(`"${campo}" precisa ser um UUID.`);
  }
  return valor;
}

// ── Query (sempre texto) ────────────────────────────────────────────────────

/** Id inteiro positivo; também serve para query string. */
export function idValido(valor: unknown, campo: string): number {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0) {
    throw new BadRequestException(`"${campo}" precisa ser um número inteiro positivo.`);
  }
  return n;
}

export const idDaQuery = (valor: string | undefined, campo: string) =>
  valor === undefined || valor === '' ? undefined : idValido(valor, campo);

export function dataDaQuery(
  valor: string | undefined,
  campo: string,
): string | undefined {
  if (valor === undefined || valor === '') return undefined;
  const iso = dataIso(valor);
  if (!iso) {
    throw new BadRequestException(`"${campo}" precisa ser uma data AAAA-MM-DD.`);
  }
  return iso;
}

/** Valor que precisa ser um dos itens da lista (ex.: um status). */
export function umDe<T extends string>(
  valor: string,
  opcoes: readonly T[],
  campo: string,
): T {
  if (!opcoes.includes(valor as T)) {
    throw new BadRequestException(
      `"${campo}" inválido: "${valor}". Use um de: ${opcoes.join(', ')}.`,
    );
  }
  return valor as T;
}
