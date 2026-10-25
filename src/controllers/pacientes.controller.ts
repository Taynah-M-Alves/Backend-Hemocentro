import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { UsuarioId } from '../decorators/usuario-id.decorator.js';
import { lerBuscarPacientesDto } from '../dtos/paciente.dto.js';
import { PacienteService } from '../services/paciente.service.js';

/** Telas Consulta de prontuário e Ficha completa (somente leitura). */
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientes: PacienteService) {}

  /** GET /api/pacientes?nome=&dataNascimento=&nomeMae=&prontuario=&pagina=&limite= */
  @Get()
  buscar(@Query() query: Record<string, string | undefined>) {
    return this.pacientes.buscar(lerBuscarPacientesDto(query));
  }

  /** GET /api/pacientes/:id — grava CONSULTA (X-Usuario-Id opcional) */
  @Get(':id')
  detalhe(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioId(true) usuarioId: number | null,
  ) {
    return this.pacientes.detalhe(id, usuarioId);
  }

  /** GET /api/pacientes/:id/historico */
  @Get(':id/historico')
  historico(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientes.historico(id);
  }

  /** GET /api/pacientes/:id/ficha-completa — grava CONSULTA (X-Usuario-Id opcional) */
  @Get(':id/ficha-completa')
  fichaCompleta(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioId(true) usuarioId: number | null,
  ) {
    return this.pacientes.fichaCompleta(id, usuarioId);
  }
}
