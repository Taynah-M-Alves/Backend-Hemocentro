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
  UseGuards,
} from '@nestjs/common';
import { lerInstituicaoDto } from '../dtos/instituicao.dto.js';
import { SomenteGestorGuard } from '../guards/somente-gestor.guard.js';
import { InstituicaoService } from '../services/instituicao.service.js';

@Controller('instituicoes')
export class InstituicoesController {
  constructor(private readonly instituicoes: InstituicaoService) {}

  /** GET /api/instituicoes — opções ativas para as fichas. */
  @Get()
  listar() {
    return this.instituicoes.listar();
  }

  /** GET /api/instituicoes/gerenciamento — ativos e inativos. */
  @Get('gerenciamento')
  @UseGuards(SomenteGestorGuard)
  listarGerenciamento() {
    return this.instituicoes.listarGerenciamento();
  }

  /** POST /api/instituicoes — { nome }. */
  @Post()
  @UseGuards(SomenteGestorGuard)
  criar(@Body() body: unknown) {
    return this.instituicoes.criar(lerInstituicaoDto(body));
  }

  /** PATCH /api/instituicoes/:id — { nome }. */
  @Patch(':id')
  @UseGuards(SomenteGestorGuard)
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.instituicoes.alterar(id, lerInstituicaoDto(body));
  }

  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SomenteGestorGuard)
  inativar(@Param('id', ParseIntPipe) id: number) {
    return this.instituicoes.definirAtivo(id, false);
  }

  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SomenteGestorGuard)
  reativar(@Param('id', ParseIntPipe) id: number) {
    return this.instituicoes.definirAtivo(id, true);
  }
}
