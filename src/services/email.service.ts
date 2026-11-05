import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

/** Envio de e-mails (SMTP_* no .env). Sem SMTP_HOST, fora de produção, o e-mail aparece no terminal. */
@Injectable()
export class EmailService {
  private readonly transporte = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA },
      })
    : undefined;

  async enviar(para: string, assunto: string, texto: string, html?: string): Promise<void> {
    if (!this.transporte) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP_HOST não configurado no .env.');
      }
      Logger.warn(
        `SMTP_HOST não configurado. E-mail para ${para}:\n${texto}`,
        'EmailService',
      );
      return;
    }
    await this.transporte.sendMail({
      from: process.env.SMTP_REMETENTE ?? process.env.SMTP_USUARIO,
      to: para,
      subject: assunto,
      text: texto,
      html: html ?? texto,
    });
  }
}
