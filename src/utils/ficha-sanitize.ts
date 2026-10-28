import {
  Abo,
  GrupoAbo,
  Raca,
  ResultadoTeste,
  Rh,
  Sexo,
  TipoKitId,
} from '../generated/prisma/enums.js';
import type {
  FichaExtraida,
  KitExtraido,
  PacienteExtraido,
  PesquisaExtraida,
  TransfusaoExtraida,
} from '../types/ficha.types.js';

// A IA (e o PATCH da revisão) devolve "qualquer coisa" (unknown). Aqui conferimos campo
// por campo e convertemos para os tipos do banco: valor ilegível ou inválido vira null.
// Aceita tanto o texto da ficha ("O+", "Branco") quanto o nome do enum ("O_POSITIVO", "BRANCO").

type Obj = Record<string, unknown>;

const MAIOR_INT_POSTGRES = 2_147_483_647;
const ANO_MINIMO = 1900;

/** Converte a resposta crua para `FichaExtraida`. Só lança erro se nem for um objeto. */
export function sanitizarFicha(bruto: unknown): FichaExtraida {
  if (!isObj(bruto)) throw new Error('A resposta não é um objeto JSON.');

  return {
    dataAtendimento: dataIso(bruto.dataAtendimento),
    motivo: texto(bruto.motivo),
    paciente: sanitizarPaciente(isObj(bruto.paciente) ? bruto.paciente : {}),
    transfusoes: lista(bruto.transfusoes).map(sanitizarTransfusao),
    pesquisas: lista(bruto.pesquisas).map(sanitizarPesquisa),
    kits: lista(bruto.kits).map(sanitizarKit),
  };
}

/**
 * Lança erro se faltar o mínimo para identificar o paciente (nome + data de nascimento).
 * Na leitura, faz o AiExtractionService tentar a próxima IA; na aprovação, vira 422.
 */
export function exigirIdentificacao(ficha: FichaExtraida): void {
  const faltando = [
    !ficha.paciente.nome && 'nome do paciente',
    !ficha.paciente.dataNascimento && 'data de nascimento',
  ].filter(Boolean);
  if (faltando.length) {
    throw new Error(
      `Não foi possível ler com segurança: ${faltando.join(' e ')}.`,
    );
  }
}

/** Campos sem os quais uma transfusão não é gravada. */
export function camposFaltandoNaTransfusao(t: TransfusaoExtraida): string[] {
  const obrigatorios: [string, unknown][] = [
    ['data do envio', t.dataEnvio],
    ['tipo de hemocomponente', t.tipoHemocomponente],
    ['número da doação', t.numeroDoacao],
    ['GR.S/RhD', t.grsRhd],
    ['volume', t.volMl],
    ['PAI', t.testesPai],
    ['prova cruzada', t.provaCruzada],
  ];
  return obrigatorios
    .filter(([, valor]) => valor === null)
    .map(([campo]) => campo);
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
  return {
    nome: nomePessoa(p.nome),
    dataNascimento: dataIso(p.dataNascimento),
    nomeSocial: texto(p.nomeSocial),
    prontuario: inteiro(p.prontuario),
    sexo: sexo(p.sexo),
    raca: raca(p.raca ?? p.racaCor),
    aboRh: abo(p.aboRh),
    cpf: digitos(p.cpf, 11, 11),
    cartaoSus: digitos(p.cartaoSus, 15, 15),
    diagnostico: texto(p.diagnostico),
    nomeMae: nomePessoa(p.nomeMae),
    nomePai: nomePessoa(p.nomePai),
    alergias: texto(p.alergias),
    municipio: texto(p.municipio, 120),
    ufMunicipio: uf(p.ufMunicipio),
  };
}

function sanitizarTransfusao(t: Obj): TransfusaoExtraida {
  return {
    dataEnvio: dataIso(t.dataEnvio),
    tipoHemocomponente: texto(t.tipoHemocomponente, 100),
    numeroDoacao: digitos(t.numeroDoacao, 1, 30),
    numeroServico: texto(t.numeroServico, 30),
    tracejador: texto(t.tracejador, 50),
    grsRhd: abo(t.grsRhd),
    volMl: inteiro(t.volMl),
    testesPai: resultadoTeste(t.testesPai),
    provaCruzada: resultadoTeste(t.provaCruzada),
    cidadeDestino: texto(t.cidadeDestino, 120),
    ufDestino: uf(t.ufDestino),
    responsavelLiberacao: texto(t.responsavelLiberacao),
    pagina: inteiro(t.pagina),
  };
}

function sanitizarPesquisa(p: Obj): PesquisaExtraida {
  return {
    dataPesquisa: dataIso(p.dataPesquisa ?? p.data),
    gs: grupoAbo(p.gs),
    rh: rh(p.rh),
    dFraco: texto(p.dFraco, 50),
    pai: texto(p.pai, 50),
    tad: texto(p.tad, 50),
    autocontrole: texto(p.autocontrole, 50),
    dcScreening: texto(p.dcScreening, 50),
    especificidade: texto(p.especificidade),
    interpretacao: texto(p.interpretacao),
    observacao: texto(p.observacao),
    amostra: texto(p.amostra, 50),
    metodologia: texto(p.metodologia, 100),
    responsavel: texto(p.responsavel),
    fenotipagem: lista(p.fenotipagem).flatMap((f) => {
      const antigeno = texto(f.antigeno, 10);
      const resultado = texto(f.resultado, 5);
      return antigeno && resultado ? [{ antigeno, resultado }] : [];
    }),
    pagina: inteiro(p.pagina),
  };
}

function sanitizarKit(k: Obj): KitExtraido {
  return {
    tipo: tipoKit(k.tipo),
    dataPesquisa: dataIso(k.dataPesquisa ?? k.data),
    gs: grupoAbo(k.gs),
    rh: rh(k.rh),
    tad: texto(k.tad, 50),
    pai: texto(k.pai, 50),
    autocontrole: texto(k.autocontrole, 50),
    interpretacao: texto(k.interpretacao),
    tecnica: texto(k.tecnica, 100),
    observacao: texto(k.observacao),
    resultados: lista(k.resultados).flatMap((r) => {
      const celula = inteiro(r.celula);
      return celula === null
        ? []
        : [
            {
              celula,
              lissCoombs: texto(r.lissCoombs, 5),
              enzima: texto(r.enzima, 5),
              frio: texto(r.frio, 5),
            },
          ];
    }),
    pagina: inteiro(k.pagina),
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

/** Sem acentos e em maiúsculas, para comparar com os enums. */
function normalizado(v: unknown): string {
  return (texto(v) ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/** Só os dígitos, se a quantidade estiver entre min e max (CPF, cartão SUS, nº da doação). */
function digitos(v: unknown, min: number, max: number): string | null {
  const so = texto(v)?.replace(/\D/g, '') ?? '';
  return so.length >= min && so.length <= max ? so : null;
}

function uf(v: unknown): string | null {
  const sigla = normalizado(v);
  return /^[A-Z]{2}$/.test(sigla) ? sigla : null;
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

/**
 * "Positivo"/"POS" → POSITIVO, "Negativo"/"NEG" → NEGATIVO, "NR"/"Não realizado" → NAO_REALIZADO.
 * Vazio ou ilegível fica null: NR está escrito no papel, null é a falta de leitura.
 */
function resultadoTeste(v: unknown): ResultadoTeste | null {
  const valor = normalizado(v);
  if (valor.startsWith('POS')) return ResultadoTeste.POSITIVO;
  if (valor.startsWith('NEG')) return ResultadoTeste.NEGATIVO;
  if (valor === 'NR' || /^NAO.?REALIZ/.test(valor)) return ResultadoTeste.NAO_REALIZADO;
  return null;
}

function sexo(v: unknown): Sexo | null {
  const valor = normalizado(v);
  if (valor.startsWith('F')) return Sexo.F;
  if (valor.startsWith('M')) return Sexo.M;
  return null;
}

/** Na ficha a raça pode vir como código: 1=Branco, 2=Preto, 3=Pardo, 4=Amarelo, 5=Indígena. */
const RACAS: [string, Raca][] = [
  ['BRANC', Raca.BRANCO],
  ['PRET', Raca.PRETO],
  ['PARD', Raca.PARDO],
  ['AMAREL', Raca.AMARELO],
  ['INDIGEN', Raca.INDIGENA],
];

function raca(v: unknown): Raca | null {
  const valor = normalizado(v);
  const porCodigo = /^[1-5]$/.test(valor) ? RACAS[Number(valor) - 1] : null;
  return (porCodigo ?? RACAS.find(([p]) => valor.startsWith(p)))?.[1] ?? null;
}

/** "O+", "O Pos", "O positivo", "O_POSITIVO" → O_POSITIVO (o zero é lido como O). */
function abo(v: unknown): Abo | null {
  const m = normalizado(v)
    .replace(/[\s_]/g, '')
    .match(/^(AB|A|B|O|0)(\+|-|POS|NEG)/);
  if (!m) return null;
  const grupo = m[1] === '0' ? 'O' : m[1];
  const sinal = m[2] === '+' || m[2] === 'POS' ? 'POSITIVO' : 'NEGATIVO';
  return Abo[`${grupo}_${sinal}` as keyof typeof Abo];
}

/** Só o grupo: "O", "AB" (ignora um Rh escrito junto, como "O+"). */
function grupoAbo(v: unknown): GrupoAbo | null {
  const m = normalizado(v).match(/^(AB|A|B|O|0)(?![A-Z])/);
  if (!m) return null;
  return m[1] === '0' ? GrupoAbo.O : GrupoAbo[m[1] as keyof typeof GrupoAbo];
}

function rh(v: unknown): Rh | null {
  const valor = normalizado(v);
  if (valor.startsWith('POS') || valor === '+') return Rh.POSITIVO;
  if (valor.startsWith('NEG') || valor === '-') return Rh.NEGATIVO;
  if (/^(ND|NAO.?DET|INDET)/.test(valor)) return Rh.NAO_DETERMINADO;
  return null;
}

function tipoKit(v: unknown): TipoKitId | null {
  const valor = normalizado(v).replace(/[^A-Z]/g, '');
  if (valor.includes('DIACELL')) return TipoKitId.DIACELL;
  if (valor.includes('DIAPANEL')) return TipoKitId.DIAPANEL;
  return null;
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
