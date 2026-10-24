import { Module } from '@nestjs/common';
import { AuditoriaController } from './controllers/auditoria.controller.js';
import { CidadesController } from './controllers/cidades.controller.js';
import { ColaboradoresController } from './controllers/colaboradores.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DocumentosController } from './controllers/documentos.controller.js';
import { FichasController } from './controllers/fichas.controller.js';
import { LotesController } from './controllers/lotes.controller.js';
import { PacientesController } from './controllers/pacientes.controller.js';
import { UsuariosController } from './controllers/usuarios.controller.js';
import { AiExtractionService } from './services/ai-extraction.service.js';
import { AuditoriaService } from './services/auditoria.service.js';
import { CidadeService } from './services/cidade.service.js';
import { ColaboradorService } from './services/colaborador.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { DocumentoImagemService } from './services/documento-imagem.service.js';
import { DocumentoService } from './services/documento.service.js';
import { FichaPersistenciaService } from './services/ficha-persistencia.service.js';
import { FichaService } from './services/ficha.service.js';
import { FilaLeituraService } from './services/fila-leitura.service.js';
import { LoteService } from './services/lote.service.js';
import { PacienteService } from './services/paciente.service.js';
import { PrismaService } from './services/prisma.service.js';
import { UsuarioService } from './services/usuario.service.js';

@Module({
  controllers: [
    LotesController,
    DocumentosController,
    FichasController,
    PacientesController,
    AuditoriaController,
    DashboardController,
    UsuariosController,
    ColaboradoresController,
    CidadesController,
  ],
  providers: [
    PrismaService,
    AiExtractionService,
    DocumentoImagemService,
    FilaLeituraService,
    FichaPersistenciaService,
    LoteService,
    DocumentoService,
    FichaService,
    PacienteService,
    AuditoriaService,
    DashboardService,
    UsuarioService,
    ColaboradorService,
    CidadeService,
  ],
})
export class AppModule {}
