import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  MAXIMO_ARQUIVOS_POR_ENVIO,
  uploadLoteOptions,
} from '../config/upload.config.js';
import { LoteService } from '../services/lote.service.js';
import { paginacao } from '../utils/paginacao.js';

/** Tela Upload. */
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LoteService) {}

  /**
   * POST /api/lotes — multipart/form-data: "arquivos" (1 a 30 PDF/JPEG/PNG, até 50 MB e
   * 20 páginas cada) e "nome" (opcional). Responde 202 sem esperar a IA.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FilesInterceptor('arquivos', MAXIMO_ARQUIVOS_POR_ENVIO, uploadLoteOptions))
  criar(
    @UploadedFiles() arquivos: Express.Multer.File[] | undefined,
    @Body() body: unknown,
    // Lido cru (e conferido no service) para que um header inválido também apague os arquivos já salvos
    @Headers('x-usuario-id') usuarioId: string | undefined,
  ) {
    return this.lotes.criar(arquivos ?? [], body, usuarioId);
  }

  /** GET /api/lotes?pagina=&limite= */
  @Get()
  listar(@Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.lotes.listar(paginacao(pagina, limite));
  }

  /** GET /api/lotes/:id — progresso do lote e situação de cada arquivo */
  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.lotes.detalhe(id);
  }
}
