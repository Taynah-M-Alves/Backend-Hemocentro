import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { lerFiltroEventosDto } from '../dtos/auditoria.dto.js';
import { AuditoriaService } from '../services/auditoria.service.js';

/** Tela Auditoria (e "Atividade recente" do Dashboard). Somente leitura. */
@Controller('auditoria/eventos')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  /** GET /api/auditoria/eventos?busca=&de=&ate=&tipo=&usuarioId=&fichaId=&pacienteId=&pagina=&limite= */
  @Get()
  listar(@Query() query: Record<string, string | undefined>) {
    return this.auditoria.listar(lerFiltroEventosDto(query));
  }

  /** GET /api/auditoria/eventos/exportar — mesmos filtros, em CSV (declarada antes de :id) */
  @Get('exportar')
  async exportar(@Query() query: Record<string, string | undefined>) {
    const csv = await this.auditoria.exportarCsv(lerFiltroEventosDto(query));
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="trilha-auditoria.csv"',
    });
  }

  /** GET /api/auditoria/eventos/:id */
  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.auditoria.detalhe(id);
  }
}
