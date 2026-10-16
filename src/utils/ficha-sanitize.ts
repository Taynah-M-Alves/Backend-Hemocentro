import { ResultadoTeste } from '../generated/prisma/enums.js';
import type {
  FichaExtraida,
  PacienteExtraido,
  PesquisaExtraida,
  TransfusaoExtraida,
} from '../types/ficha.types.js';

// A IA devolve "qualquer coisa" (unknown). Aqui conferimos campo por campo e
// convertemos para os tipos certos. Assim o resto do código pode confiar nos dados.

type Obj = Record<string, unknown>;

const MAIOR_INT_POSTGRES = 2_147_483_647;
const ANO_MINIMO = 1900;

/**
 * Converte a resposta crua da IA para `FichaExtraida`.
 * Lança erro se faltar o mínimo para identificar o paciente (nome + data de nascimento):
 * assim o AiExtractionService entende que essa IA falhou e tenta a próxima.
 */
export function sanitizarFicha(bruto: unknown): FichaExtraida {
  if (!isObj(bruto) || !isObj(bruto.paciente)) {
    throw new Error('Resposta sem o objeto "paciente".');
  }

  return {
    paciente: sanitizarPaciente(bruto.paciente),
    transfusoes: lista(bruto.transfusoes).map(sanitizarTransfusao),
    pesquisas: lista(bruto.pesquisas).map(sanitizarPesquisa),
  };
}

/** Aceita "AAAA-MM-DD" ou "DD/MM/AAAA" (também com "." ou "-") e devolve "AAAA-MM-DD". */
export function dataIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const partes = lerPartesDaData(v.trim());
  if (!partes) return null;
  const { ano, mes, dia } = partes;

  // Confere se a data existe (ex.: 31/02 é inválida)
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;

  // Descarta anos absurdos, que costumam ser erro de leitura (ex.: "1002" em vez de "1993")
  const anoPlausivel = ano >= ANO_MINIMO && ano <= new Date().getFullYear() + 1;

  return existe && anoPlausivel ? data.toISOString().slice(0, 10) : null;
}

// ── Partes da ficha ─────────────────────────────────────────────────────────

function sanitizarPaciente(p: Obj): PacienteExtraido {
  const nome = nomePessoa(p.nome);
  const dataNascimento = dataIso(p.dataNascimento);

  if (!nome || !dataNascimento) {
    const faltando = [
      !nome && 'nome do paciente',
      !dataNascimento && 'data de nascimento',
    ];
    throw new Error(
      `Não foi possível ler com segurança: ${faltando.filter(Boolean).join(' e ')}.`,
    );
  }

  return {
    nome,
    dataNascimento,
    prontuario: inteiro(p.prontuario),
    racaCor: texto(p.racaCor, 50),
    aboRh: texto(p.aboRh, 10),
    diagnostico: texto(p.diagnostico),
    nomeMae: nomePessoa(p.nomeMae),
  };
}

function sanitizarTransfusao(t: Obj): TransfusaoExtraida {
  const numeroDoacao =
    texto(t.numeroDoacao)?.replace(/\D/g, '').slice(0, 30) || null;
  return {
    dataEnvio: dataIso(t.dataEnvio),
    tipoHemocomponente: texto(t.tipoHemocomponente, 100),
    numeroDoacao,
    grsRhd: texto(t.grsRhd, 50),
    volMl: inteiro(t.volMl),
    testesPai: resultadoTeste(t.testesPai),
    provaCruzada: resultadoTeste(t.provaCruzada),
    cidadeDestino: texto(t.cidadeDestino, 120),
    ufDestino: texto(t.ufDestino, 2)?.toUpperCase() ?? null,
    responsavelLiberacao: texto(t.responsavelLiberacao),
  };
}

function sanitizarPesquisa(p: Obj): PesquisaExtraida {
  return {
    data: dataIso(p.data),
    gs: texto(p.gs, 10),
    rh: texto(p.rh, 10),
    tad: texto(p.tad, 50),
    pai: texto(p.pai, 50),
    autocontrole: texto(p.autocontrole, 50),
    interpretacao: texto(p.interpretacao),
    responsavel: texto(p.responsavel),
  };
}

// ── Campos ──────────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function lista(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter(isObj) : [];
}

/** Texto limpo, cortado no tamanho máximo da coluna do banco. */
function texto(v: unknown, max = 255): string | null {
  const valor = typeof v === 'number' ? String(v) : v;
  if (typeof valor !== 'string') return null;
  const limpo = valor.replace(/\s+/g, ' ').trim();
  return limpo ? limpo.slice(0, max) : null;
}

/** Inteiro positivo que cabe numa coluna Int do Postgres. */
function inteiro(v: unknown): number | null {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? Number(v.replace(/\D/g, ''))
        : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= MAIOR_INT_POSTGRES ? n : null;
}

/**
 * Nome de pessoa: só letras, ao menos duas palavras com 2+ letras ("Fulana Vidal").
 * Barra leituras quebradas, como "CC e" ou "q OX Ih NES".
 */
function nomePessoa(v: unknown): string | null {
  const nome = texto(v);
  if (!nome || !/^[A-Za-zÀ-ÿ'. ]+$/.test(nome)) return null;
  const palavras = nome
    .split(' ')
    .filter((p) => p.replace(/\W/g, '').length >= 2);
  const valido =
    palavras.length >= 2 && palavras.every((p) => /[a-zà-ÿ]/.test(p));
  return valido ? nome : null;
}

/** "Positivo"/"POS" → POSITIVO, "Negativo"/"NEG" → NEGATIVO, qualquer outra coisa → NR. */
function resultadoTeste(v: unknown): ResultadoTeste {
  const valor = texto(v)?.toUpperCase() ?? '';
  if (valor.startsWith('POS')) return ResultadoTeste.POSITIVO;
  if (valor.startsWith('NEG')) return ResultadoTeste.NEGATIVO;
  return ResultadoTeste.NR;
}

function lerPartesDaData(
  s: string,
): { ano: number; mes: number; dia: number } | null {
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso)
    return { ano: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) };

  const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!br) return null;

  // Ano com 2 dígitos: "93" → 1993, "26" → 2026
  const ano = Number(br[3]);
  const anoCompleto = ano >= 100 ? ano : ano + (ano > 30 ? 1900 : 2000);
  return { ano: anoCompleto, mes: Number(br[2]), dia: Number(br[1]) };
}
