import { Injectable, NotFoundException } from '@nestjs/common';
import type { BuscarPacientesDto } from '../dtos/paciente.dto.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import type { PacienteExtraido } from '../types/ficha.types.js';
import {
  codigoFicha,
  codigoLote,
  contem,
  dataSemHora,
  idade,
  igual,
  nomeMunicipio,
  paraData,
} from '../utils/formatos.js';
import { paginado } from '../utils/paginacao.js';
import { PrismaService } from './prisma.service.js';
import { UsuarioService } from './usuario.service.js';

const VALIDADAS = { where: { status: StatusFicha.VALIDADA } } as const;
const COM_UF = { include: { estados: { select: { uf: true } } } } as const;

/**
 * Pacientes são somente leitura na API: só nascem ou mudam pela aprovação de uma ficha.
 * Campo sem informação volta null ("Não informado nos registros validados").
 */
@Injectable()
export class PacienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: UsuarioService,
  ) {}

  async buscar(dto: BuscarPacientesDto) {
    const where = {
      ...(dto.nome && { nome: contem(dto.nome) }),
      ...(dto.dataNascimento && { dataNascimento: paraData(dto.dataNascimento) }),
      ...(dto.nomeMae && { nomeMae: contem(dto.nomeMae) }),
      ...(dto.prontuario && { prontuario: dto.prontuario }),
    };
    const [pacientes, total] = await Promise.all([
      this.prisma.paciente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: dto.paginacao.skip,
        take: dto.paginacao.take,
        include: {
          municipio: COM_UF,
          _count: { select: { fichasDigitalizadas: VALIDADAS } },
        },
      }),
      this.prisma.paciente.count({ where }),
    ]);

    const itens = pacientes.map((p) => ({
      id: p.id,
      nome: p.nome,
      dataNascimento: dataSemHora(p.dataNascimento),
      idade: idade(p.dataNascimento),
      nomeMae: p.nomeMae,
      prontuario: p.prontuario,
      municipio: nomeMunicipio(p.municipio),
      fichasValidadas: p._count.fichasDigitalizadas,
    }));
    return paginado(itens, total, dto.paginacao);
  }

  /** Cabeçalho da Consulta de prontuário. Grava CONSULTA na auditoria. */
  async detalhe(id: string, usuarioId: number | null) {
    const p = await this.encontrar(id);
    const [fichas, semelhantes, ultimaValidacao] = await Promise.all([
      this.prisma.fichaDigitalizada.findMany({
        where: { pacienteId: id, status: StatusFicha.VALIDADA },
        select: { documento: { select: { totalPaginas: true } } },
      }),
      this.prisma.fichaDigitalizada.findMany({
        where: { pacienteSugeridoId: id, status: { not: StatusFicha.VALIDADA } },
        select: { id: true, status: true },
      }),
      this.ultimaValidacao(id),
    ]);
    await this.registrarConsulta(id, usuarioId);

    return {
      id: p.id,
      nome: p.nome,
      dataNascimento: dataSemHora(p.dataNascimento),
      idade: idade(p.dataNascimento),
      nomeMae: p.nomeMae,
      prontuario: p.prontuario,
      cpf: p.cpf,
      municipio: nomeMunicipio(p.municipio),
      totais: {
        fichasValidadas: fichas.length,
        paginasDeOrigem: fichas.reduce(
          (soma, f) => soma + (f.documento.totalPaginas ?? 0),
          0,
        ),
      },
      ultimaValidacao,
      fichasSemelhantesEmRevisao: semelhantes.map((f) => ({
        id: f.id,
        codigo: codigoFicha(f.id),
        status: f.status,
      })),
    };
  }

  /** Fichas validadas, mais recente primeiro (abas Histórico e Documentos de origem). */
  async historico(id: string) {
    await this.encontrar(id);
    const fichas = await this.prisma.fichaDigitalizada.findMany({
      where: { pacienteId: id, status: StatusFicha.VALIDADA },
      orderBy: { validadoEm: 'desc' },
      include: { documento: true, validadoPor: { select: { nome: true } } },
    });
    return fichas.map((f) => ({
      ficha: { id: f.id, codigo: codigoFicha(f.id) },
      dataAtendimento: dataSemHora(f.dataAtendimento),
      documento: {
        id: f.documento.id,
        nomeOriginal: f.documento.nomeOriginal,
        totalPaginas: f.documento.totalPaginas,
        loteCodigo: codigoLote(f.documento.loteId),
        url: `/api/documentos/${f.documento.id}/arquivo`,
      },
      validacao: { validadoPor: f.validadoPor?.nome ?? null, validadoEm: f.validadoEm },
    }));
  }

  /** Tudo do paciente, cada registro com a ficha e a página de origem. Grava CONSULTA. */
  async fichaCompleta(id: string, usuarioId: number | null) {
    const origem = {
      fichaDigitalizada: { select: { id: true } },
    } as const;
    const p = await this.prisma.paciente.findUnique({
      where: { id },
      include: {
        municipio: COM_UF,
        fichasTransfusionais: {
          orderBy: { dataEnvio: 'desc' },
          include: {
            ...origem,
            cidadeDestino: COM_UF,
            responsavelLiberacao: { select: { nome: true } },
          },
        },
        pesquisasAnticorpos: {
          orderBy: { dataPesquisa: 'desc' },
          include: {
            ...origem,
            fenotipagem: { select: { antigeno: true, resultado: true } },
            responsavelPesquisa: { select: { nome: true } },
          },
        },
        kitsId: {
          orderBy: { dataPesquisa: 'desc' },
          include: {
            ...origem,
            resultados: {
              orderBy: { celula: 'asc' },
              select: { celula: true, lissCoombs: true, enzima: true, frio: true },
            },
          },
        },
        fichasDigitalizadas: {
          ...VALIDADAS,
          orderBy: { validadoEm: 'desc' },
          include: { documento: true },
        },
      },
    });
    if (!p) throw new NotFoundException(`Paciente ${id} não encontrado.`);
    await this.registrarConsulta(id, usuarioId);

    const deOnde = (r: {
      fichaDigitalizada: { id: number } | null;
      pagina: number | null;
    }) => ({
      fichaCodigo: r.fichaDigitalizada ? codigoFicha(r.fichaDigitalizada.id) : null,
      pagina: r.pagina,
    });
    const kits = p.kitsId.map(
      ({ fichaDigitalizada, fichaDigitalizadaId: _f, pacienteId: _p, ...k }) => ({
        ...k,
        dataPesquisa: dataSemHora(k.dataPesquisa),
        origem: deOnde({ fichaDigitalizada, pagina: k.pagina }),
      }),
    );

    return {
      paciente: {
        id: p.id,
        nome: p.nome,
        nomeSocial: p.nomeSocial,
        sexo: p.sexo,
        raca: p.raca,
        aboRh: p.aboRh,
        dataNascimento: dataSemHora(p.dataNascimento),
        idade: idade(p.dataNascimento),
        prontuario: p.prontuario,
        cpf: p.cpf,
        cartaoSus: p.cartaoSus,
        diagnostico: p.diagnostico,
        nomeMae: p.nomeMae,
        nomePai: p.nomePai,
        alergias: p.alergias,
        municipio: nomeMunicipio(p.municipio),
      },
      ultimaValidacao: await this.ultimaValidacao(id),
      transfusoes: p.fichasTransfusionais.map((t) => ({
        id: t.id,
        dataEnvio: dataSemHora(t.dataEnvio),
        tipoHemocomponente: t.tipoHemocomponente,
        numeroDoacao: t.numeroDoacao,
        numeroServico: t.numeroServico,
        tracejador: t.tracejador,
        grsRhd: t.grsRhd,
        volMl: t.volMl,
        testesPai: t.testesPai,
        provaCruzada: t.provaCruzada,
        destino: nomeMunicipio(t.cidadeDestino),
        responsavelLiberacao: t.responsavelLiberacao?.nome ?? null,
        origem: deOnde(t),
      })),
      pesquisasImunoHematologicas: p.pesquisasAnticorpos.map(
        ({
          fichaDigitalizada,
          fichaDigitalizadaId: _f,
          pacienteId: _p,
          responsavelPesquisaId: _r,
          responsavelPesquisa,
          ...r
        }) => ({
          ...r,
          dataPesquisa: dataSemHora(r.dataPesquisa),
          responsavel: responsavelPesquisa?.nome ?? null,
          origem: deOnde({ fichaDigitalizada, pagina: r.pagina }),
        }),
      ),
      kitsDiaCell: kits.filter((k) => k.tipo === 'DIACELL'),
      kitsDiaPanel: kits.filter((k) => k.tipo === 'DIAPANEL'),
      documentos: p.fichasDigitalizadas.map((f) => ({
        fichaCodigo: codigoFicha(f.id),
        documentoId: f.documento.id,
        nomeOriginal: f.documento.nomeOriginal,
        totalPaginas: f.documento.totalPaginas,
        validadoEm: f.validadoEm,
        url: `/api/documentos/${f.documento.id}/arquivo`,
      })),
    };
  }

  /**
   * Pacientes já cadastrados com o mesmo nome e nascimento, ou o mesmo nome da mãe.
   * É uma sugestão de comparação, não a confirmação de que é a mesma pessoa.
   */
  async semelhantes(p: Pick<PacienteExtraido, 'nome' | 'dataNascimento' | 'nomeMae'>) {
    const criterios = [
      ...(p.nome && p.dataNascimento
        ? [{ nome: igual(p.nome), dataNascimento: paraData(p.dataNascimento) }]
        : []),
      ...(p.nomeMae ? [{ nomeMae: igual(p.nomeMae) }] : []),
    ];
    if (!criterios.length) return [];

    const pacientes = await this.prisma.paciente.findMany({
      where: { OR: criterios },
      take: 10,
      include: { _count: { select: { fichasDigitalizadas: VALIDADAS } } },
    });
    const mesmo = (a: string | null, b: string | null) =>
      !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

    return pacientes
      .map((x) => ({
        id: x.id,
        nome: x.nome,
        dataNascimento: dataSemHora(x.dataNascimento),
        nomeMae: x.nomeMae,
        prontuario: x.prontuario,
        fichasValidadas: x._count.fichasDigitalizadas,
        coincide: [
          mesmo(x.nome, p.nome) && 'nome',
          dataSemHora(x.dataNascimento) === p.dataNascimento && 'dataNascimento',
          mesmo(x.nomeMae, p.nomeMae) && 'nomeMae',
        ].filter((c): c is string => !!c),
      }))
      .sort((a, b) => b.coincide.length - a.coincide.length);
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private async encontrar(id: string) {
    const p = await this.prisma.paciente.findUnique({
      where: { id },
      include: { municipio: COM_UF },
    });
    if (!p) throw new NotFoundException(`Paciente ${id} não encontrado.`);
    return p;
  }

  private async ultimaValidacao(pacienteId: string) {
    const f = await this.prisma.fichaDigitalizada.findFirst({
      where: { pacienteId, status: StatusFicha.VALIDADA },
      orderBy: { validadoEm: 'desc' },
      include: { validadoPor: { select: { nome: true } } },
    });
    return f
      ? {
          fichaCodigo: codigoFicha(f.id),
          validadoPor: f.validadoPor?.nome ?? null,
          validadoEm: f.validadoEm,
        }
      : null;
  }

  private async registrarConsulta(pacienteId: string, usuarioId: number | null) {
    if (usuarioId !== null) await this.usuarios.exigirAtivo(usuarioId);
    await this.prisma.eventoAuditoria.create({
      data: { tipo: 'CONSULTA', usuarioId, pacienteId },
    });
  }
}
