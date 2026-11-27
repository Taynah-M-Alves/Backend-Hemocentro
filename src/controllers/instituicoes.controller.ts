import { Controller, Get } from '@nestjs/common';
import { InstituicaoService } from '../services/instituicao.service.js';

@Controller('instituicoes')
export class InstituicoesController {
  constructor(private readonly instituicoes: InstituicaoService) {}

  /** GET /api/instituicoes — ativas, em ordem alfabética */
  @Get()
  listar() {
    return this.instituicoes.listar();
  }
}
