import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MAXIMO_PAGINAS_POR_ARQUIVO } from '../config/upload.config.js';
import { lerCriarLoteDto } from '../dtos/lote.dto.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import { codigoLote, nomeDigitalizacao } from '../utils/formatos.js';
import { paginado, type Paginacao } from '../utils/paginacao.js';
import { idValido } from '../utils/validacao.js';
import { DocumentoImagemService } from './documento-imagem.service.js';
import { FilaLeituraService } from './fila-leitura.service.js';
import { PrismaService } from './prisma.service.js';
import { UsuarioService } from './usuario.service.js';

/**
 * Tela Upload. O envio só salva e registra (responde 202 na hora); a IA lê depois,
 * em segundo plano, e a tela acompanha o progresso pelo GET /api/lotes/:id.
 */
@Injectable()
export class LoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: UsuarioService,
    private readonly imagens: DocumentoImagemService,
    private readonly fila: FilaLeituraService,
  ) {}

  /** Cada arquivo = uma ficha de um paciente: cria Lote, Documento e FichaDigitalizada (ENVIADA). */
  async criar(arquivos: Express.Multer.File[], body: unknown, cabecalhoUsuario?: string) {
    try {
      const dto = lerCriarLoteDto(body);
      const usuarioId = idValido(cabecalhoUsuario, 'X-Usuario-Id');
      if (!arquivos.length) {
        throw new BadRequestException(
          'Nenhum arquivo recebido. Envie os arquivos no campo "arquivos" via multipart/form-data.',
        );
      }
      await this.usuarios.exigirAtivo(usuarioId);
      const conferidos = await Promise.all(arquivos.map((a) => this.conferir(a)));

      // Mesmo conteúdo já enviado antes: aceita, mas avisa na resposta
      const repetidos = await this.prisma.documento.findMany({
        where: { sha256: { in: conferidos.map((c) => c.sha256) } },
        select: { id: true, sha256: true },
      });
      const repetidoDe = new Map(repetidos.map((d) => [d.sha256, d.id]));

      const lote = await this.prisma.$transaction(async (tx) => {
        const novo = await tx.lote.create({
          data: { nome: dto.nome ?? nomePadrao(), enviadoPorId: usuarioId },
        });
        const documentos = [];
        for (const c of conferidos) {
          const doc = await tx.documento.create({
            data: {
              loteId: novo.id,
              chave: path.basename(c.arquivo.path),
              nomeOriginal: c.nomeOriginal,
              mimeType: c.arquivo.mimetype,
              tamanhoBytes: c.arquivo.size,
              sha256: c.sha256,
              totalPaginas: c.totalPaginas,
              ficha: { create: {} },
            },
            include: { ficha: { select: { id: true, status: true } } },
          });
          documentos.push(doc);
        }
        await tx.eventoAuditoria.createMany({
          data: documentos.map((d) => ({
            tipo: 'LOTE_ENVIADO' as const,
            usuarioId,
            loteId: novo.id,
            documentoId: d.id,
            fichaId: d.ficha!.id,
          })),
        });
        return { ...novo, documentos };
      });

      void this.fila.processar();
      return {
        id: lote.id,
        codigo: codigoLote(lote.id),
        nome: lote.nome,
        enviadoEm: lote.enviadoEm,
        documentos: lote.documentos.map((d, i) => ({
          id: d.id,
          nome: nomeDigitalizacao(lote.id, i + 1, lote.nome),
          nomeOriginal: d.nomeOriginal,
          tamanhoBytes: d.tamanhoBytes,
          totalPaginas: d.totalPaginas,
          fichaId: d.ficha!.id,
          status: d.ficha!.status,
          repetidoDoDocumentoId: repetidoDe.get(d.sha256) ?? null,
        })),
      };
    } catch (err) {
      // Nada foi gravado: os arquivos salvos pelo upload não ficam soltos na pasta
      await Promise.all(arquivos.map((a) => fs.promises.unlink(a.path).catch(() => undefined)));
      throw err;
    }
  }

  async listar(p: Paginacao) {
    const [lotes, total] = await Promise.all([
      this.prisma.lote.findMany({
        orderBy: { enviadoEm: 'desc' },
        skip: p.skip,
        take: p.take,
        include: {
          enviadoPor: { select: { id: true, nome: true } },
          documentos: { select: { totalPaginas: true, ficha: { select: { status: true } } } },
        },
      }),
      this.prisma.lote.count(),
    ]);
    const itens = lotes.map(({ documentos, enviadoPorId: _e, ...l }) => ({
      ...l,
      codigo: codigoLote(l.id),
      totalArquivos: documentos.length,
      totalPaginas: somaPaginas(documentos),
      prontosParaRevisao: documentos.filter(
        (d) => d.ficha?.status === StatusFicha.AGUARDANDO_REVISAO,
      ).length,
    }));
    return paginado(itens, total, p);
  }

  /** Progresso do lote. A tela repete a consulta enquanto houver arquivo em ENVIADA ou LENDO. */
  async detalhe(id: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: {
        enviadoPor: { select: { id: true, nome: true } },
        documentos: {
          orderBy: { id: 'asc' },
          include: { ficha: { select: { id: true, status: true, erroLeitura: true } } },
        },
      },
    });
    if (!lote) throw new NotFoundException(`Lote ${id} não encontrado.`);

    const porStatus: Partial<Record<StatusFicha, number>> = {};
    for (const d of lote.documentos) {
      if (d.ficha) porStatus[d.ficha.status] = (porStatus[d.ficha.status] ?? 0) + 1;
    }
    return {
      id: lote.id,
      codigo: codigoLote(lote.id),
      nome: lote.nome,
      enviadoPor: lote.enviadoPor,
      enviadoEm: lote.enviadoEm,
      totalArquivos: lote.documentos.length,
      totalPaginas: somaPaginas(lote.documentos),
      porStatus,
      documentos: lote.documentos.map((d, i) => ({
        id: d.id,
        nome: nomeDigitalizacao(lote.id, i + 1, lote.nome),
        nomeOriginal: d.nomeOriginal,
        mimeType: d.mimeType,
        totalPaginas: d.totalPaginas,
        tamanhoBytes: d.tamanhoBytes,
        fichaId: d.ficha?.id ?? null,
        status: d.ficha?.status ?? null,
        erro: d.ficha?.erroLeitura ?? null,
      })),
    };
  }

  /** Confere páginas e calcula o sha256 antes de gravar qualquer coisa. */
  private async conferir(arquivo: Express.Multer.File) {
    // O multer entrega o nome em latin1; acentos ("ana_luísa.pdf") precisam voltar para UTF-8
    const nomeOriginal = Buffer.from(arquivo.originalname, 'latin1').toString('utf8');
    const conteudo = await fs.promises.readFile(arquivo.path);

    let totalPaginas: number;
    try {
      totalPaginas = await this.imagens.contarPaginas(conteudo, arquivo.mimetype);
    } catch {
      throw new BadRequestException(`"${nomeOriginal}" não abre: o PDF parece corrompido.`);
    }
    if (totalPaginas > MAXIMO_PAGINAS_POR_ARQUIVO) {
      throw new BadRequestException(
        `"${nomeOriginal}" tem ${totalPaginas} páginas; o máximo é ${MAXIMO_PAGINAS_POR_ARQUIVO} por arquivo.`,
      );
    }
    return {
      arquivo,
      nomeOriginal: nomeOriginal.slice(0, 255),
      totalPaginas,
      sha256: createHash('sha256').update(conteudo).digest('hex'),
    };
  }
}

const somaPaginas = (documentos: { totalPaginas: number | null }[]) =>
  documentos.reduce((soma, d) => soma + (d.totalPaginas ?? 0), 0);

/** "25-10-2026" (data de Cuiabá); cada arquivo aparece como "12.1 - 25-10-2026". */
const nomePadrao = () =>
  new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' }).replaceAll('/', '-');
