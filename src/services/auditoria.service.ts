import { Injectable, NotFoundException } from '@nestjs/common';
import type { FiltroEventosDto } from '../dtos/auditoria.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TipoEvento } from '../generated/prisma/enums.js';
import {
  codigoEvento,
  codigoFicha,
  codigoLote,
  contem,
  paraData,
} from '../utils/formatos.js';
import { paginado } from '../utils/paginacao.js';
import { PrismaService } from './prisma.service.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

const RESUMO = {
  usuario: { select: { id: true, nome: true } },
  paciente: { select: { id: true, nome: true } },
} as const;

/**
 * Tela Auditoria: só lê. Os eventos são gravados pelas próprias rotas (upload, leitura,
 * revisão, aprovação, consulta) e nunca são editados ou apagados.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(dto: FiltroEventosDto) {
    const where = filtro(dto);
    const comTipo = (tipo: TipoEvento) => ({ AND: [where, { tipo }] });
    const [eventos, total, edicoes, validacoes] = await Promise.all([
      this.prisma.eventoAuditoria.findMany({
        where,
        orderBy: { ocorridoEm: 'desc' },
        skip: dto.paginacao.skip,
        take: dto.paginacao.take,
        include: RESUMO,
      }),
      this.prisma.eventoAuditoria.count({ where }),
      this.prisma.eventoAuditoria.count({ where: comTipo(TipoEvento.CAMPO_EDITADO) }),
      this.prisma.eventoAuditoria.count({ where: comTipo(TipoEvento.FICHA_VALIDADA) }),
    ]);

    const itens = eventos.map((e) => ({
      id: e.id,
      codigo: codigoEvento(e.id),
      tipo: e.tipo,
      ocorridoEm: e.ocorridoEm,
      usuario: e.usuario, // null = o próprio sistema (fila da IA)
      ficha: e.fichaId ? { id: e.fichaId, codigo: codigoFicha(e.fichaId) } : null,
      lote: e.loteId ? { id: e.loteId, codigo: codigoLote(e.loteId) } : null,
      paciente: e.paciente,
      campo: e.campo,
      pagina: e.pagina,
    }));
    return {
      contadores: { eventos: total, edicoes, validacoes },
      ...paginado(itens, total, dto.paginacao),
    };
  }

  /** O evento inteiro, com o documento de origem para "Abrir ficha de origem". */
  async detalhe(id: number) {
    const e = await this.prisma.eventoAuditoria.findUnique({
      where: { id },
      include: {
        ...RESUMO,
        documento: true,
        ficha: { select: { documento: true } },
      },
    });
    if (!e) throw new NotFoundException(`Evento ${id} não encontrado.`);

    const { documento, ficha, ...evento } = e;
    const origem = documento ?? ficha?.documento ?? null;
    return {
      ...evento,
      codigo: codigoEvento(e.id),
      fichaCodigo: e.fichaId ? codigoFicha(e.fichaId) : null,
      loteCodigo: e.loteId ? codigoLote(e.loteId) : null,
      documento: origem && {
        id: origem.id,
        nomeOriginal: origem.nomeOriginal,
        url: `/api/documentos/${origem.id}/arquivo`,
      },
    };
  }

  /** Mesmos filtros, sem paginação, em CSV (";" e UTF-8 com BOM, para abrir no Excel em português). */
  async exportarCsv(dto: FiltroEventosDto): Promise<string> {
    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: filtro(dto),
      orderBy: { ocorridoEm: 'desc' },
      include: RESUMO,
    });
    const cabecalho = [
      'codigo', 'ocorrido_em', 'tipo', 'usuario', 'ficha', 'lote', 'paciente',
      'campo', 'pagina', 'valor_anterior', 'valor_posterior', 'justificativa',
    ];
    const linhas = eventos.map((e) => [
      codigoEvento(e.id),
      e.ocorridoEm.toISOString(),
      e.tipo,
      e.usuario?.nome ?? 'Sistema',
      e.fichaId ? codigoFicha(e.fichaId) : '',
      e.loteId ? codigoLote(e.loteId) : '',
      e.paciente?.nome ?? '',
      e.campo ?? '',
      e.pagina ?? '',
      e.valorAnterior ?? '',
      e.valorPosterior ?? '',
      e.justificativa ?? '',
    ]);
    return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\r\n');
  }
}

function filtro(dto: FiltroEventosDto): Prisma.EventoAuditoriaWhereInput {
  const ficha = dto.busca?.match(/^FIC-?(\d+)$/i);
  const lote = dto.busca?.match(/^DEM-?(\d+)$/i);
  return {
    ...(dto.tipo && { tipo: dto.tipo }),
    ...(dto.usuarioId && { usuarioId: dto.usuarioId }),
    ...(dto.fichaId && { fichaId: dto.fichaId }),
    ...(dto.pacienteId && { pacienteId: dto.pacienteId }),
    // shortcut: "de" e "ate" são dias em UTC (Cuiabá é UTC-4); trocar se os relatórios exigirem o dia local
    ...((dto.de || dto.ate) && {
      ocorridoEm: {
        ...(dto.de && { gte: paraData(dto.de) }),
        ...(dto.ate && { lt: new Date(paraData(dto.ate).getTime() + UM_DIA_MS) }),
      },
    }),
    ...(dto.busca &&
      (ficha
        ? { fichaId: Number(ficha[1]) }
        : lote
          ? { loteId: Number(lote[1]) }
          : { paciente: { nome: contem(dto.busca) } })),
  };
}

/** Aspas em volta e, contra fórmulas no Excel, um apóstrofo antes de = + - @. */
function celulaCsv(valor: string | number): string {
  const texto = String(valor);
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}
