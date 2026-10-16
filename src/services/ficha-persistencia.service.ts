import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  FichaExtraida,
  PacienteExtraido,
  PesquisaExtraida,
  ResumoGravacao,
  TransfusaoExtraida,
} from '../types/ficha.types.js';
import { PrismaService } from './prisma.service.js';

type Tx = Prisma.TransactionClient;

export interface ResultadoGravacao {
  resumo: ResumoGravacao;
  /** Linhas não gravadas ou gravadas sem algum dado, para conferência */
  avisos: string[];
}

/** "2026-05-05" → Date (as colunas são @db.Date, só dia/mês/ano) */
const paraData = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Busca sem diferenciar maiúsculas/minúsculas: "marcia" encontra "Marcia". */
const igual = (valor: string) => ({
  equals: valor,
  mode: 'insensitive' as const,
});

/**
 * Grava no banco o que foi extraído da ficha.
 * Tudo roda dentro de uma TRANSAÇÃO: ou grava tudo, ou não grava nada.
 * Enviar o mesmo documento duas vezes não duplica dados.
 */
@Injectable()
export class FichaPersistenciaService {
  constructor(private readonly prisma: PrismaService) {}

  salvar(ficha: FichaExtraida): Promise<ResultadoGravacao> {
    return this.prisma.$transaction(async (tx) => {
      const avisos: string[] = [];
      const { id: pacienteId, criado } = await this.salvarPaciente(
        tx,
        ficha.paciente,
      );

      const resumo: ResumoGravacao = {
        pacienteId,
        pacienteCriado: criado,
        transfusoesCriadas: 0,
        transfusoesIgnoradas: 0,
        pesquisasCriadas: 0,
        pesquisasIgnoradas: 0,
      };

      for (const [i, transfusao] of ficha.transfusoes.entries()) {
        const criada = await this.salvarTransfusao(
          tx,
          pacienteId,
          transfusao,
          `Transfusão ${i + 1}`,
          avisos,
        );
        if (criada) resumo.transfusoesCriadas++;
        else resumo.transfusoesIgnoradas++;
      }

      for (const [i, pesquisa] of ficha.pesquisas.entries()) {
        const criada = await this.salvarPesquisa(
          tx,
          pacienteId,
          pesquisa,
          `Pesquisa ${i + 1}`,
          avisos,
        );
        if (criada) resumo.pesquisasCriadas++;
        else resumo.pesquisasIgnoradas++;
      }

      return { resumo, avisos };
    });
  }

  // ── Paciente ──────────────────────────────────────────────────────────────

  /**
   * Procura o paciente pelo prontuário; sem prontuário, por nome + data de nascimento.
   * Se já existe, só preenche campos que estavam vazios (nunca apaga o que já foi gravado).
   */
  private async salvarPaciente(
    tx: Tx,
    p: PacienteExtraido,
  ): Promise<{ id: string; criado: boolean }> {
    const dataNascimento = paraData(p.dataNascimento);
    const existente =
      (p.prontuario !== null &&
        (await tx.paciente.findUnique({
          where: { prontuario: p.prontuario },
        }))) ||
      (await tx.paciente.findFirst({
        where: { nome: igual(p.nome), dataNascimento },
      }));

    if (!existente) {
      const novo = await tx.paciente.create({ data: { ...p, dataNascimento } });
      return { id: novo.id, criado: true };
    }

    await tx.paciente.update({
      where: { id: existente.id },
      data: {
        prontuario: existente.prontuario ?? p.prontuario,
        racaCor: existente.racaCor ?? p.racaCor,
        aboRh: existente.aboRh ?? p.aboRh,
        diagnostico: existente.diagnostico ?? p.diagnostico,
        nomeMae: existente.nomeMae ?? p.nomeMae,
      },
    });
    return { id: existente.id, criado: false };
  }

  // ── Transfusão ────────────────────────────────────────────────────────────

  /** Devolve true se criou a linha; false se ignorou (incompleta ou já existente). */
  private async salvarTransfusao(
    tx: Tx,
    pacienteId: string,
    t: TransfusaoExtraida,
    rotulo: string,
    avisos: string[],
  ): Promise<boolean> {
    const { dataEnvio, tipoHemocomponente, numeroDoacao, grsRhd, volMl } = t;
    if (
      !dataEnvio ||
      !tipoHemocomponente ||
      !numeroDoacao ||
      !grsRhd ||
      volMl === null
    ) {
      avisos.push(
        `${rotulo} não foi gravada: faltou ${camposFaltandoNaTransfusao(t).join(', ')}.`,
      );
      return false;
    }

    // O número da doação é único: se já existe, o documento já foi enviado antes
    if (await tx.fichaTransfusional.findUnique({ where: { numeroDoacao } })) {
      avisos.push(`${rotulo} (doação ${numeroDoacao}) já estava no banco.`);
      return false;
    }

    await tx.fichaTransfusional.create({
      data: {
        pacienteId,
        dataEnvio: paraData(dataEnvio),
        tipoHemocomponente,
        numeroDoacao,
        grsRhd,
        volMl,
        testesPai: t.testesPai,
        provaCruzada: t.provaCruzada,
        cidadeDestinoId: await this.idCidade(tx, t, rotulo, avisos),
        responsavelLiberacaoId: await this.idColaborador(
          tx,
          t.responsavelLiberacao,
        ),
      },
    });
    return true;
  }

  // ── Pesquisa de anticorpos ────────────────────────────────────────────────

  /** Devolve true se criou a linha; false se ignorou (incompleta ou já existente). */
  private async salvarPesquisa(
    tx: Tx,
    pacienteId: string,
    p: PesquisaExtraida,
    rotulo: string,
    avisos: string[],
  ): Promise<boolean> {
    if (!p.data || !p.gs || !p.rh) {
      avisos.push(
        `${rotulo} não foi gravada: faltou data, grupo sanguíneo (GS) ou Rh.`,
      );
      return false;
    }

    const dados = {
      pacienteId,
      data: paraData(p.data),
      gs: p.gs,
      rh: p.rh,
      tad: p.tad,
      pai: p.pai,
      autocontrole: p.autocontrole,
      interpretacao: p.interpretacao,
    };

    // Mesmo paciente + mesma data + mesmos resultados = documento repetido
    if (await tx.pesquisaAnticorpos.findFirst({ where: dados })) {
      avisos.push(`${rotulo} (${p.data}) já estava no banco.`);
      return false;
    }

    await tx.pesquisaAnticorpos.create({
      data: {
        ...dados,
        responsavelPesquisaId: await this.idColaborador(tx, p.responsavel),
      },
    });
    return true;
  }

  // ── Tabelas auxiliares (busca ou cria) ────────────────────────────────────

  private async idCidade(
    tx: Tx,
    t: TransfusaoExtraida,
    rotulo: string,
    avisos: string[],
  ): Promise<number | null> {
    if (!t.cidadeDestino) return null;
    if (!t.ufDestino) {
      avisos.push(
        `${rotulo}: cidade "${t.cidadeDestino}" sem UF; destino não gravado.`,
      );
      return null;
    }

    const cidade =
      (await tx.cidade.findFirst({
        where: { nomeCidade: igual(t.cidadeDestino), uf: t.ufDestino },
      })) ??
      (await tx.cidade.create({
        data: { nomeCidade: t.cidadeDestino, uf: t.ufDestino },
      }));
    return cidade.id;
  }

  private async idColaborador(
    tx: Tx,
    nome: string | null,
  ): Promise<number | null> {
    if (!nome) return null;
    const colaborador =
      (await tx.colaborador.findFirst({ where: { nome: igual(nome) } })) ??
      (await tx.colaborador.create({ data: { nome } }));
    return colaborador.id;
  }
}

function camposFaltandoNaTransfusao(t: TransfusaoExtraida): string[] {
  const obrigatorios: [string, unknown][] = [
    ['data do envio', t.dataEnvio],
    ['tipo de hemocomponente', t.tipoHemocomponente],
    ['número da doação', t.numeroDoacao],
    ['GR.S/RhD', t.grsRhd],
    ['volume', t.volMl],
  ];
  return obrigatorios
    .filter(([, valor]) => valor === null)
    .map(([campo]) => campo);
}
