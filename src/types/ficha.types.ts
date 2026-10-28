import type {
  Abo,
  GrupoAbo,
  Raca,
  ResultadoTeste,
  Rh,
  Sexo,
  TipoKitId,
} from '../generated/prisma/enums.js';

// Dados lidos da ficha, já conferidos por sanitizarFicha(). É o formato de
// FichaDigitalizada.dadosExtraidos: o rascunho que a revisão corrige antes de aprovar.
// Datas sempre no formato "AAAA-MM-DD". `null` = campo vazio ou ilegível.
// `pagina` = página do arquivo de onde o dado veio.

export interface PacienteExtraido {
  /** Obrigatório para aprovar: sem nome não dá para identificar o paciente */
  nome: string | null;
  /** Obrigatório para aprovar: junto com o nome, identifica o paciente sem prontuário */
  dataNascimento: string | null;
  nomeSocial: string | null;
  prontuario: number | null;
  sexo: Sexo | null;
  raca: Raca | null;
  aboRh: Abo | null;
  cpf: string | null;
  cartaoSus: string | null;
  diagnostico: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  alergias: string | null;
  municipio: string | null;
  ufMunicipio: string | null;
}

/** Uma linha da tabela da Ficha Transfusional. */
export interface TransfusaoExtraida {
  dataEnvio: string | null;
  tipoHemocomponente: string | null;
  numeroDoacao: string | null;
  numeroServico: string | null;
  tracejador: string | null;
  grsRhd: Abo | null;
  volMl: number | null;
  /** NAO_REALIZADO = "NR" escrito na ficha; null = vazio ou ilegível */
  testesPai: ResultadoTeste | null;
  provaCruzada: ResultadoTeste | null;
  cidadeDestino: string | null;
  ufDestino: string | null;
  responsavelLiberacao: string | null;
  pagina: number | null;
}

/** Pesquisa Imuno Hematológica. */
export interface PesquisaExtraida {
  dataPesquisa: string | null;
  gs: GrupoAbo | null;
  rh: Rh | null;
  dFraco: string | null;
  pai: string | null;
  tad: string | null;
  autocontrole: string | null;
  dcScreening: string | null;
  especificidade: string | null;
  interpretacao: string | null;
  observacao: string | null;
  amostra: string | null;
  metodologia: string | null;
  responsavel: string | null;
  fenotipagem: { antigeno: string; resultado: string }[];
  pagina: number | null;
}

/** Folha Bio-Rad ID-DiaCell I-II ou ID-DiaPanel. */
export interface KitExtraido {
  tipo: TipoKitId | null;
  dataPesquisa: string | null;
  gs: GrupoAbo | null;
  rh: Rh | null;
  tad: string | null;
  pai: string | null;
  autocontrole: string | null;
  interpretacao: string | null;
  tecnica: string | null;
  observacao: string | null;
  resultados: {
    celula: number;
    lissCoombs: string | null;
    enzima: string | null;
    frio: string | null;
  }[];
  pagina: number | null;
}

export interface FichaExtraida {
  dataAtendimento: string | null;
  motivo: string | null;
  paciente: PacienteExtraido;
  transfusoes: TransfusaoExtraida[];
  pesquisas: PesquisaExtraida[];
  kits: KitExtraido[];
}

/** O que foi gravado no banco na aprovação de uma ficha. */
export interface ResumoGravacao {
  pacienteId: string;
  pacienteCriado: boolean;
  transfusoesCriadas: number;
  transfusoesIgnoradas: number;
  pesquisasCriadas: number;
  pesquisasIgnoradas: number;
  kitsCriados: number;
  kitsIgnorados: number;
}
