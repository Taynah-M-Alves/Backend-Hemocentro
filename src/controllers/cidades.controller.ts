import { Controller, Get, Query } from '@nestjs/common';
import { CidadeService } from '../services/cidade.service.js';

@Controller('cidades')
export class CidadesController {
  constructor(private readonly cidades: CidadeService) {}

  /** GET /api/cidades?busca=cuia&uf=MT */
  @Get()
  buscar(@Query('busca') busca?: string, @Query('uf') uf?: string) {
    return this.cidades.buscar(busca, uf);
  }
}
