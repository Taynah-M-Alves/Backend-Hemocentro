import type { ResultadoTeste } from '../generated/prisma/enums.js';

// Dados lidos da ficha, já conferidos por sanitizarFicha().
// Datas sempre no formato "AAAA-MM-DD". `null` = campo vazio ou ilegível.

export interface PacienteExtraido {
  /** Obrigatório: sem nome não dá para identificar o paciente */
  nome: string;
  /** Obrigatório: junto com o nome, identifica o paciente sem prontuário */
  dataNascimento: string;
  prontuario: number | null;
  racaCor: string | null;
  aboRh: string | null;
  diagnostico: string | null;
  nomeMae: string | null;
}

/** Uma linha da tabela da Ficha Transfusional. */
export interface TransfusaoExtraida {
  dataEnvio: string | null;
  tipoHemocomponente: string | null;
  numeroDoacao: string | null;
  grsRhd: string | null;
  volMl: number | null;
  testesPai: ResultadoTeste;
  provaCruzada: ResultadoTeste;
  cidadeDestino: string | null;
  ufDestino: string | null;
  responsavelLiberacao: string | null;
}

/** Um documento de pesquisa de anticorpos (Bio-Rad ou Pesquisa Imuno Hematológica). */
export interface PesquisaExtraida {
  data: string | null;
  gs: string | null;
  rh: string | null;
  tad: string | null;
  pai: string | null;
  autocontrole: string | null;
  interpretacao: string | null;
  responsavel: string | null;
}

export interface FichaExtraida {
  paciente: PacienteExtraido;
  transfusoes: TransfusaoExtraida[];
  pesquisas: PesquisaExtraida[];
}

/** O que foi gravado no banco a partir de uma ficha. */
export interface ResumoGravacao {
  pacienteId: string;
  pacienteCriado: boolean;
  transfusoesCriadas: number;
  transfusoesIgnoradas: number;
  pesquisasCriadas: number;
  pesquisasIgnoradas: number;
}
