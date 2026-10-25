import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsuarioId } from '../decorators/usuario-id.decorator.js';
import {
  lerAlterarDadosDto,
  lerAprovarFichaDto,
  lerAssumirRevisaoDto,
  lerFiltroFichasDto,
  lerPendenciaDto,
} from '../dtos/ficha.dto.js';
import { FichaService } from '../services/ficha.service.js';

/** Telas Fila de revisão e Revisar ficha. As ações exigem o header X-Usuario-Id. */
@Controller('fichas')
export class FichasController {
  constructor(private readonly fichas: FichaService) {}

  /** GET /api/fichas?status=&loteId=&revisorId=&busca=&ordenar=atencao|recentes&pagina=&limite= */
  @Get()
  listar(@Query() query: Record<string, string | undefined>) {
    return this.fichas.listar(lerFiltroFichasDto(query));
  }

  /** GET /api/fichas/:id — a ficha com os dados lidos pela IA, para editar */
  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.fichas.detalhe(id);
  }

  /** GET /api/fichas/:id/semelhantes — pacientes já cadastrados parecidos */
  @Get(':id/semelhantes')
  semelhantes(@Param('id', ParseIntPipe) id: number) {
    return this.fichas.semelhantes(id);
  }

  /** POST /api/fichas/:id/iniciar-revisao — sem body */
  @Post(':id/iniciar-revisao')
  @HttpCode(HttpStatus.OK)
  iniciarRevisao(@Param('id', ParseIntPipe) id: number, @UsuarioId() usuarioId: number) {
    return this.fichas.iniciarRevisao(id, usuarioId);
  }

  /** POST /api/fichas/:id/assumir-revisao — body { "justificativa"? } */
  @Post(':id/assumir-revisao')
  @HttpCode(HttpStatus.OK)
  assumirRevisao(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioId() usuarioId: number,
    @Body() body: unknown,
  ) {
    return this.fichas.assumirRevisao(id, usuarioId, lerAssumirRevisaoDto(body));
  }

  /** PATCH /api/fichas/:id/dados — body { "alteracoes": [{ campo, valor, pagina?, justificativa? }] } */
  @Patch(':id/dados')
  alterarDados(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioId() usuarioId: number,
    @Body() body: unknown,
  ) {
    return this.fichas.alterarDados(id, usuarioId, lerAlterarDadosDto(body));
  }

  /** POST /api/fichas/:id/pendencia — body { "motivo" } */
  @Post(':id/pendencia')
  @HttpCode(HttpStatus.OK)
  sinalizarPendencia(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioId() usuarioId: number,
    @Body() body: unknown,
  ) {
    return this.fichas.sinalizarPendencia(id, usuarioId, lerPendenciaDto(body));
  }

  /** POST /api/fichas/:id/aprovar — body { "pacienteId"? }; sem pacienteId cria paciente novo */
  @Post(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  aprovar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioId() usuarioId: number,
    @Body() body: unknown,
  ) {
    return this.fichas.aprovar(id, usuarioId, lerAprovarFichaDto(body));
  }
}
