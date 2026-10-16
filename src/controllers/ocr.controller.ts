import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadFichaOptions } from '../config/upload.config.js';
import { OcrService } from '../services/ocr.service.js';
import type { OcrApiResponse } from '../types/ocr.types.js';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * POST /ocr/extract
   *
   * Recebe a ficha digitalizada (PDF, JPEG ou PNG) via multipart/form-data (campo "file"),
   * extrai os dados do paciente, das transfusões e das pesquisas de anticorpos e grava no banco.
   *
   * Respostas: 200 = gravado | 400 = arquivo inválido | 422 = não foi possível ler/gravar
   *
   * Exemplo:
   *   curl -X POST http://localhost:3000/ocr/extract -F "file=@ficha_paciente.pdf"
   */
  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', uploadFichaOptions))
  async extrairFicha(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
  ): Promise<OcrApiResponse> {
    if (!arquivo) {
      throw new BadRequestException(
        'Nenhum arquivo recebido. Envie o arquivo no campo "file" via multipart/form-data.',
      );
    }

    const resposta = await this.ocrService.processarFicha(arquivo);
    if (!resposta.sucesso) {
      throw new HttpException(resposta, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return resposta;
  }
}
