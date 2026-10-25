import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  FichaExtraida,
  KitExtraido,
  PacienteExtraido,
  PesquisaExtraida,
  ResumoGravacao,
  TransfusaoExtraida,
} from '../types/ficha.types.js';
import { camposFaltandoNaTransfusao } from '../utils/ficha-sanitize.js';
import { igual, paraData } from '../utils/formatos.js';

type Tx = Prisma.TransactionClient;

export interface ResultadoGravacao {
  resumo: ResumoGravacao;
  /** Linhas não gravadas ou gravadas sem algum dado, para conferência */
  avisos: string[];
}

/** Paciente com nome e nascimento já conferidos (exigirIdentificacao). */
type PacienteIdentificado = PacienteExtraido & {
  nome: string;
  dataNascimento: string;
};

/** Cidade ou colaborador citado na ficha; `campo` é o caminho usado no PATCH da revisão. */
type Referencia =
  | { tipo: 'cidade'; campo: string; nome: string; uf: string | null }
  | { tipo: 'colaborador'; campo: string; nome: string };

/**
 * Grava nas tabelas clínicas o que foi revisado numa ficha (POST /api/fichas/:id/aprovar).
 * Roda dentro da transação de quem chama: ou grava tudo, ou não grava nada.
 * Cada registro guarda a ficha e a página de origem. Linhas repetidas são ignoradas.
 * Cidades e colaboradores não são criados aqui: precisam já estar cadastrados (referenciasInvalidas).
 */
@Injectable()
export class FichaPersistenciaService {
  /**
   * Cidades e colaboradores da ficha que não estão no banco, uma mensagem por campo.
   * Com `anterior`, só confere os valores que não estavam lá (o PATCH não trava por causa do que a IA leu).
   */
  async referenciasInvalidas(
    db: Tx,
    ficha: FichaExtraida,
    anterior?: FichaExtraida,
  ): Promise<string[]> {
    const jaEstavam = new Set(anterior ? referencias(anterior).map(chave) : []);
    const erros: string[] = [];
    for (const r of referencias(ficha)) {
      if (jaEstavam.has(chave(r))) continue;
      if (r.tipo === 'colaborador') {
        if (!(await this.idColaborador(db, r.nome))) {
          erros.push(
            `"${r.campo}": colaborador "${r.nome}" não está cadastrado (cadastre em POST /api/colaboradores ou corrija o nome).`,
          );
        }
      } else if (!r.uf) {
        erros.push(`"${r.campo}": informe a UF da cidade "${r.nome}".`);
      } else if (!(await this.idCidade(db, r.nome, r.uf))) {
        erros.push(`"${r.campo}": cidade "${r.nome} / ${r.uf}" não está cadastrada.`);
      }
    }
    return erros;
  }

  async salvar(
    tx: Tx,
    ficha: FichaExtraida & { paciente: PacienteIdentificado },
    fichaId: number,
    pacienteExistenteId: string | null,
  ): Promise<ResultadoGravacao> {
    const avisos: string[] = [];
    const { id: pacienteId, criado } = await this.salvarPaciente(
      tx,
      ficha.paciente,
      pacienteExistenteId,
    );
    const origem = { pacienteId, fichaDigitalizadaId: fichaId };

    const resumo: ResumoGravacao = {
      pacienteId,
      pacienteCriado: criado,
      transfusoesCriadas: 0,
      transfusoesIgnoradas: 0,
      pesquisasCriadas: 0,
      pesquisasIgnoradas: 0,
      kitsCriados: 0,
      kitsIgnorados: 0,
    };

    for (const [i, t] of ficha.transfusoes.entries()) {
      if (await this.salvarTransfusao(tx, origem, t, `Transfusão ${i + 1}`, avisos))
        resumo.transfusoesCriadas++;
      else resumo.transfusoesIgnoradas++;
    }
    for (const [i, p] of ficha.pesquisas.entries()) {
      if (await this.salvarPesquisa(tx, origem, p, `Pesquisa ${i + 1}`, avisos))
        resumo.pesquisasCriadas++;
      else resumo.pesquisasIgnoradas++;
    }
    for (const [i, k] of ficha.kits.entries()) {
      if (await this.salvarKit(tx, origem, k, `Kit ${i + 1}`, avisos))
        resumo.kitsCriados++;
      else resumo.kitsIgnorados++;
    }

    return { resumo, avisos };
  }

  // ── Paciente ──────────────────────────────────────────────────────────────

  /**
   * Sem pacienteExistenteId, cria um paciente novo. Com ele, liga a ficha a esse paciente
   * e só preenche campos que estavam vazios (nunca apaga o que já foi gravado).
   */
  private async salvarPaciente(
    tx: Tx,
    p: PacienteIdentificado,
    pacienteExistenteId: string | null,
  ): Promise<{ id: string; criado: boolean }> {
    const { municipio, ufMunicipio, ...campos } = p;
    const dados = {
      ...campos,
      dataNascimento: paraData(p.dataNascimento),
      municipioId: await this.idCidade(tx, municipio, ufMunicipio),
    };

    if (!pacienteExistenteId) {
      const novo = await tx.paciente.create({ data: dados });
      return { id: novo.id, criado: true };
    }

    const existente = await tx.paciente.findUnique({
      where: { id: pacienteExistenteId },
    });
    if (!existente) {
      throw new NotFoundException(`Paciente ${pacienteExistenteId} não encontrado.`);
    }
    const vazios = Object.fromEntries(
      Object.entries(dados).filter(
        ([campo, valor]) =>
          valor !== null && existente[campo as keyof typeof existente] === null,
      ),
    );
    await tx.paciente.update({ where: { id: existente.id }, data: vazios });
    return { id: existente.id, criado: false };
  }

  // ── Registros clínicos ────────────────────────────────────────────────────

  private async salvarTransfusao(
    tx: Tx,
    origem: { pacienteId: string; fichaDigitalizadaId: number },
    t: TransfusaoExtraida,
    rotulo: string,
    avisos: string[],
  ): Promise<boolean> {
    const { dataEnvio, tipoHemocomponente, numeroDoacao, grsRhd, volMl } = t;
    if (!dataEnvio || !tipoHemocomponente || !numeroDoacao || !grsRhd || volMl === null) {
      avisos.push(
        `${rotulo} não foi gravada: faltou ${camposFaltandoNaTransfusao(t).join(', ')}.`,
      );
      return false;
    }

    // O número da doação é único: se já existe, a linha já foi gravada antes
    if (await tx.fichaTransfusional.findUnique({ where: { numeroDoacao } })) {
      avisos.push(`${rotulo} (doação ${numeroDoacao}) já estava no banco.`);
      return false;
    }

    await tx.fichaTransfusional.create({
      data: {
        ...origem,
        dataEnvio: paraData(dataEnvio),
        tipoHemocomponente,
        numeroDoacao,
        numeroServico: t.numeroServico,
        tracejador: t.tracejador,
        grsRhd,
        volMl,
        testesPai: t.testesPai,
        provaCruzada: t.provaCruzada,
        pagina: t.pagina,
        cidadeDestinoId: await this.idCidade(tx, t.cidadeDestino, t.ufDestino),
        responsavelLiberacaoId: await this.idColaborador(tx, t.responsavelLiberacao),
      },
    });
    return true;
  }

  private async salvarPesquisa(
    tx: Tx,
    origem: { pacienteId: string; fichaDigitalizadaId: number },
    p: PesquisaExtraida,
    rotulo: string,
    avisos: string[],
  ): Promise<boolean> {
    if (!p.dataPesquisa) {
      avisos.push(`${rotulo} não foi gravada: faltou a data.`);
      return false;
    }

    const { dataPesquisa, responsavel, fenotipagem, ...resultados } = p;
    // Mesmo paciente + mesma data + mesmos resultados = documento repetido
    const chave = {
      pacienteId: origem.pacienteId,
      dataPesquisa: paraData(dataPesquisa),
      gs: p.gs,
      rh: p.rh,
      tad: p.tad,
      pai: p.pai,
      autocontrole: p.autocontrole,
      interpretacao: p.interpretacao,
    };
    if (await tx.pesquisaAnticorpos.findFirst({ where: chave })) {
      avisos.push(`${rotulo} (${dataPesquisa}) já estava no banco.`);
      return false;
    }

    await tx.pesquisaAnticorpos.create({
      data: {
        ...resultados,
        ...origem,
        dataPesquisa: chave.dataPesquisa,
        responsavelPesquisaId: await this.idColaborador(tx, responsavel),
        fenotipagem: { create: fenotipagem },
      },
    });
    return true;
  }

  private async salvarKit(
    tx: Tx,
    origem: { pacienteId: string; fichaDigitalizadaId: number },
    k: KitExtraido,
    rotulo: string,
    avisos: string[],
  ): Promise<boolean> {
    const { tipo, dataPesquisa, resultados, ...campos } = k;
    if (!tipo || !dataPesquisa) {
      avisos.push(`${rotulo} não foi gravado: faltou o tipo (DiaCell/DiaPanel) ou a data.`);
      return false;
    }

    const chave = {
      pacienteId: origem.pacienteId,
      tipo,
      dataPesquisa: paraData(dataPesquisa),
      interpretacao: k.interpretacao,
    };
    if (await tx.kitId.findFirst({ where: chave })) {
      avisos.push(`${rotulo} (${dataPesquisa}) já estava no banco.`);
      return false;
    }

    await tx.kitId.create({
      data: {
        ...campos,
        ...chave,
        fichaDigitalizadaId: origem.fichaDigitalizadaId,
        // Uma célula repetida na leitura violaria @@unique([kitId, celula]); fica a última
        resultados: {
          create: [...new Map(resultados.map((r) => [r.celula, r])).values()],
        },
      },
    });
    return true;
  }

  // ── Tabelas auxiliares (só busca) ─────────────────────────────────────────

  private async idCidade(
    db: Tx,
    nomeCidade: string | null,
    uf: string | null,
  ): Promise<number | null> {
    if (!nomeCidade || !uf) return null;
    const cidade = await db.cidade.findFirst({
      where: { nomeCidade: igual(nomeCidade), estados: { uf } },
      select: { id: true },
    });
    return cidade?.id ?? null;
  }

  private async idColaborador(db: Tx, nome: string | null): Promise<number | null> {
    if (!nome) return null;
    const colaborador = await db.colaborador.findFirst({
      where: { nome: igual(nome) },
      select: { id: true },
    });
    return colaborador?.id ?? null;
  }
}

/** Cidades (com a UF) e colaboradores citados na ficha. */
function referencias(f: FichaExtraida): Referencia[] {
  const cidade = (campo: string, nome: string | null, uf: string | null): Referencia[] =>
    nome ? [{ tipo: 'cidade', campo, nome, uf }] : [];
  const colaborador = (campo: string, nome: string | null): Referencia[] =>
    nome ? [{ tipo: 'colaborador', campo, nome }] : [];
  return [
    ...cidade('paciente.municipio', f.paciente.municipio, f.paciente.ufMunicipio),
    ...f.transfusoes.flatMap((t, i) => [
      ...cidade(`transfusoes[${i}].cidadeDestino`, t.cidadeDestino, t.ufDestino),
      ...colaborador(`transfusoes[${i}].responsavelLiberacao`, t.responsavelLiberacao),
    ]),
    ...f.pesquisas.flatMap((p, i) => colaborador(`pesquisas[${i}].responsavel`, p.responsavel)),
  ];
}

/** Compara pelo valor, não pelo campo: remover uma linha muda os índices das seguintes. */
const chave = (r: Referencia) =>
  `${r.tipo}|${r.nome}|${r.tipo === 'cidade' ? r.uf : ''}`.toLowerCase();
