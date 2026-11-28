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
  UseGuards,
} from '@nestjs/common';
import { lerCriarColaboradorDto } from '../dtos/colaborador.dto.js';
import { SomenteGestorGuard } from '../guards/somente-gestor.guard.js';
import { ColaboradorService } from '../services/colaborador.service.js';

@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradores: ColaboradorService) {}

  /** GET /api/colaboradores?busca=mar — opções ativas para as fichas. */
  @Get()
  buscar(@Query('busca') busca?: string) {
    return this.colaboradores.buscar(busca, true);
  }

  /** GET /api/colaboradores/gerenciamento — ativos e inativos. */
  @Get('gerenciamento')
  @UseGuards(SomenteGestorGuard)
  listarGerenciamento() {
    return this.colaboradores.listarGerenciamento();
  }

  /** POST /api/colaboradores — { nome }. */
  @Post()
  @UseGuards(SomenteGestorGuard)
  criar(@Body() body: unknown) {
    return this.colaboradores.criar(lerCriarColaboradorDto(body));
  }

  /** PATCH /api/colaboradores/:id — { nome }. */
  @Patch(':id')
  @UseGuards(SomenteGestorGuard)
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.colaboradores.alterar(id, lerCriarColaboradorDto(body));
  }

  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SomenteGestorGuard)
  inativar(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradores.definirAtivo(id, false);
  }

  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SomenteGestorGuard)
  reativar(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradores.definirAtivo(id, true);
  }
}
