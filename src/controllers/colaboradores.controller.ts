import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { lerCriarColaboradorDto } from '../dtos/colaborador.dto.js';
import { ColaboradorService } from '../services/colaborador.service.js';

@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradores: ColaboradorService) {}

  /** GET /api/colaboradores?busca=mar (mínimo 2 letras) */
  @Get()
  buscar(@Query('busca') busca?: string) {
    return this.colaboradores.buscar(busca);
  }

  /** POST /api/colaboradores — 201 */
  @Post()
  criar(@Body() body: unknown) {
    return this.colaboradores.criar(lerCriarColaboradorDto(body));
  }
}
