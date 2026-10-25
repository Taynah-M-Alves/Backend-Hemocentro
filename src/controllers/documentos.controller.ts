import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { UsuarioId } from '../decorators/usuario-id.decorator.js';
import { DocumentoService } from '../services/documento.service.js';

/** Arquivo original e reprocessamento (telas Upload, Revisar ficha, Consulta e Auditoria). */
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentoService) {}

  /** GET /api/documentos/:id/arquivo — PDF ou imagem; grava CONSULTA (X-Usuario-Id opcional) */
  @Get(':id/arquivo')
  arquivo(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioId(true) usuarioId: number | null,
  ) {
    return this.documentos.arquivo(id, usuarioId);
  }

  /** POST /api/documentos/:id/reprocessar — só em FALHA_LEITURA (senão, 409) */
  @Post(':id/reprocessar')
  @HttpCode(HttpStatus.ACCEPTED)
  reprocessar(@Param('id', ParseIntPipe) id: number, @UsuarioId() usuarioId: number) {
    return this.documentos.reprocessar(id, usuarioId);
  }
}
