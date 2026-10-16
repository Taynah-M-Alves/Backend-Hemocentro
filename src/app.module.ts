import { Module } from '@nestjs/common';
import { OcrController } from './controllers/ocr.controller.js';
import { AiExtractionService } from './services/ai-extraction.service.js';
import { DocumentoImagemService } from './services/documento-imagem.service.js';
import { FichaPersistenciaService } from './services/ficha-persistencia.service.js';
import { OcrService } from './services/ocr.service.js';
import { PrismaService } from './services/prisma.service.js';

@Module({
  controllers: [OcrController],
  providers: [
    PrismaService,
    OcrService,
    DocumentoImagemService,
    AiExtractionService,
    FichaPersistenciaService,
  ],
})
export class AppModule {}
