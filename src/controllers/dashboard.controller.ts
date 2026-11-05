import { Controller, Get, Query } from '@nestjs/common';
import { lerPeriodoDto } from '../dtos/auditoria.dto.js';
import { DashboardService } from '../services/dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /api/dashboard?de=AAAA-MM-DD&ate=AAAA-MM-DD (padrão: últimas 6 semanas) */
  @Get()
  indicadores(@Query() query: Record<string, string | undefined>) {
    return this.dashboard.indicadores(lerPeriodoDto(query));
  }
}
