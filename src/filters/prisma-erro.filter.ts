import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Converte os erros do banco que são culpa do pedido em respostas HTTP:
 * valor único repetido (email, prontuário...) → 409; registro não encontrado → 404.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErroFilter implements ExceptionFilter {
  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const http = this.paraHttp(err);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(http.getStatus())
      .json(http.getResponse());
  }

  private paraHttp(err: Prisma.PrismaClientKnownRequestError): HttpException {
    if (err.code === 'P2002') {
      const campos = (err.meta?.target as string[] | undefined)?.join(', ');
      return new ConflictException(
        `Já existe um registro com o mesmo valor${campos ? ` em: ${campos}` : ''}.`,
      );
    }
    if (err.code === 'P2025') return new NotFoundException('Registro não encontrado.');
    return new InternalServerErrorException(err.message);
  }
}
