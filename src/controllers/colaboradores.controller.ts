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
import { lerCriarColaboradorDto } from '../dtos/colaborador.dto.js';
import { ColaboradorService } from '../services/colaborador.service.js';

@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradores: ColaboradorService) {}

  /** GET /api/colaboradores?busca=mar&ativo=true — ativo=true só ativos, false só inativos, sem ele todos */
  @Get()
  buscar(@Query('busca') busca?: string, @Query('ativo') ativo?: string) {
    return this.colaboradores.buscar(busca, ativo === undefined ? undefined : ativo === 'true');
  }

  /** POST /api/colaboradores — 201 */
  @Post()
  criar(@Body() body: unknown) {
    return this.colaboradores.criar(lerCriarColaboradorDto(body));
  }

  /** PATCH /api/colaboradores/:id — { nome } */
  @Patch(':id')
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.colaboradores.alterar(id, lerCriarColaboradorDto(body));
  }

  /** POST /api/colaboradores/:id/inativar — some do select, continua nas fichas antigas */
  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  inativar(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradores.definirAtivo(id, false);
  }

  /** POST /api/colaboradores/:id/reativar */
  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  reativar(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradores.definirAtivo(id, true);
  }
}
