import { Injectable } from '@nestjs/common';
import type { PeriodoDto } from '../dtos/auditoria.dto.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import { dataSemHora, paraData } from '../utils/formatos.js';
import { PrismaService } from './prisma.service.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const SEIS_SEMANAS_MS = 42 * UM_DIA_MS;

/** "Completa" = todos estes campos do paciente preenchidos (CPF e nome social costumam faltar no original). */
const CAMPOS_CADASTRO = [
  'nome', 'dataNascimento', 'sexo', 'raca', 'aboRh', 'prontuario', 'cartaoSus',
  'diagnostico', 'nomeMae', 'nomePai', 'municipioId',
] as const;

/**
 * Indicadores do Dashboard. As prioridades de revisão e a atividade recente vêm de
 * GET /api/fichas?ordenar=atencao&limite=3 e GET /api/auditoria/eventos?limite=3.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async indicadores(dto: PeriodoDto) {
    const ate = dto.ate ? new Date(paraData(dto.ate).getTime() + UM_DIA_MS) : new Date();
    const de = dto.de ? paraData(dto.de) : new Date(ate.getTime() - SEIS_SEMANAS_MS);
    const periodo = { gte: de, lt: ate };

    const [criadas, validadas, emRevisao, lendo] = await Promise.all([
      this.prisma.fichaDigitalizada.findMany({
        where: { criadoEm: periodo },
        select: { criadoEm: true },
      }),
      this.prisma.fichaDigitalizada.findMany({
        where: { status: StatusFicha.VALIDADA, validadoEm: periodo },
        select: { paciente: { select: Object.fromEntries(CAMPOS_CADASTRO.map((c) => [c, true])) } },
      }),
      this.prisma.fichaDigitalizada.count({
        where: {
          status: {
            in: [StatusFicha.AGUARDANDO_REVISAO, StatusFicha.EM_REVISAO, StatusFicha.COM_PENDENCIA],
          },
        },
      }),
      this.prisma.fichaDigitalizada.count({
        where: { status: { in: [StatusFicha.ENVIADA, StatusFicha.LENDO] } },
      }),
    ]);

    const completas = validadas.filter(
      (f) => f.paciente && CAMPOS_CADASTRO.every((c) => f.paciente![c] !== null),
    ).length;

    return {
      periodo: { de: dataSemHora(de), ate: dataSemHora(new Date(ate.getTime() - 1)) },
      fichas: { digitalizadas: criadas.length, validadas: validadas.length, emRevisao, lendo },
      evolucaoSemanal: porSemana(criadas.map((f) => f.criadoEm), de, ate),
      qualidadeCadastro: {
        validadas: validadas.length,
        completas,
        percentual: validadas.length
          ? Math.round((completas / validadas.length) * 1000) / 10
          : 0,
      },
    };
  }
}

/** Fichas digitalizadas por semana (segunda-feira), incluindo semanas sem nenhuma. */
function porSemana(datas: Date[], de: Date, ate: Date) {
  const segunda = (d: Date) => {
    const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return new Date(dia.getTime() - ((dia.getUTCDay() + 6) % 7) * UM_DIA_MS);
  };
  const contagem = new Map<string, number>();
  for (let s = segunda(de); s < ate; s = new Date(s.getTime() + 7 * UM_DIA_MS)) {
    contagem.set(dataSemHora(s), 0);
  }
  for (const d of datas) {
    const chave = dataSemHora(segunda(d));
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return [...contagem].map(([semana, fichas]) => ({ semana, fichas }));
}
