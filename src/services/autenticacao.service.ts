import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service.js';
import { SenhaService } from './senha.service.js';
import { SessaoService, hashToken } from './sessao.service.js';
import { EmailService } from './email.service.js';
import { dataHoraLocal } from '../utils/formatos.js';
import { LimiteTentativas } from '../utils/limite-tentativas.js';

const VALIDADE_LINK_MS = 30 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;
const QUINZE_MINUTOS = 15 * 60 * 1000;

const escaparHtml = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function gerarTemplateEmailRedefinicao(nomeUsuario: string, link: string, dataLimite: string): string {
  const nome = escaparHtml(nomeUsuario);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Bar Decorativa -->
          <tr>
            <td style="height: 6px; background-color: #b91c1c;"></td>
          </tr>
          <!-- Cabeçalho -->
          <tr>
            <td style="padding: 36px 40px 24px; text-align: center;">
              <div style="display: inline-block; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 50%; padding: 14px; margin-bottom: 16px;">
                <span style="font-size: 26px; line-height: 1; display: block;">🩸</span>
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">Hemocentro</h1>
              <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 500;">Sistema de Gestão de Sangue e Hemocomponentes</p>
            </td>
          </tr>
          <!-- Linha Divisória -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color: #f1f5f9;"></div>
            </td>
          </tr>
          <!-- Corpo Principal -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1e293b;">
                Olá, ${nome}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Recebemos uma solicitação para redefinir a senha de acesso à sua conta no sistema do Hemocentro. Para continuar e cadastrar uma nova senha, clique no botão abaixo:
              </p>
              <!-- Botão CTA -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #b91c1c;">
                    <a href="${link}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.01em;">
                      Redefinir Minha Senha
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Caixa Informativa de Expiração -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e;">
                      ⏱️ <strong>Atenção:</strong> Por motivos de segurança, este link é válido para um único uso até <strong>${dataLimite}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
              <!-- Fallback Link Direto -->
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                Se o botão acima não funcionar, copie e cole o endereço abaixo no seu navegador:
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 24px; word-break: break-all;">
                <a href="${link}" target="_blank" style="font-size: 12px; color: #b91c1c; text-decoration: underline; line-height: 1.4;">${link}</a>
              </div>

              <!-- Aviso de Segurança -->
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 18px;">
                Se você não solicitou a troca de senha, nenhuma ação é necessária. Sua senha atual permanece segura.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Mensagem enviada automaticamente pelo sistema do Hemocentro.<br>
                Por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class AutenticacaoService implements OnModuleInit {
  private hashInexistente!: string;

  // Login: 5 erros por e-mail e 20 por IP a cada 15 min. Esqueci a senha: 5 pedidos por IP.
  private readonly loginPorEmail = new LimiteTentativas(
    5,
    QUINZE_MINUTOS,
    'Muitas tentativas de login com este e-mail.',
  );
  private readonly loginPorIp = new LimiteTentativas(
    20,
    QUINZE_MINUTOS,
    'Muitas tentativas de login a partir desta rede.',
  );
  private readonly esqueciPorIp = new LimiteTentativas(
    5,
    QUINZE_MINUTOS,
    'Muitos pedidos de nova senha a partir desta rede.',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly sessoes: SessaoService,
    private readonly email: EmailService,
  ) {}

  async onModuleInit(): Promise<void> {
    const senhaAleatoria = randomBytes(32).toString('hex');
    this.hashInexistente = await this.senhas.gerarHash(senhaAleatoria);
  }

  async entrar(email: string, senha: string, ip: string) {
    // Conta antes de conferir a senha: pedidos em paralelo não escapam do limite
    this.loginPorIp.tentar(ip);
    this.loginPorEmail.tentar(email);

    const usuario = await this.prisma.usuario.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        ativo: true,
        senhaHash: true,
        perfil: true,
        permissoes: true,
        trocarSenhaNoProximoLogin: true,
      },
    });

    const senhaValida = await this.senhas.verificar(
      senha,
      usuario?.senhaHash ?? this.hashInexistente,
    );

    if (!usuario || !usuario.ativo || !usuario.senhaHash || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Senha certa não conta como tentativa
    this.loginPorIp.desfazer(ip);
    this.loginPorEmail.desfazer(email);

    const sessao = await this.sessoes.criar(usuario.id);

    return {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        permissoes: usuario.permissoes,
        trocarSenhaNoProximoLogin: usuario.trocarSenhaNoProximoLogin,
      },
      sessao,
    };
  }

  /**
   * Troca a senha de quem está logado (obrigatório quando trocarSenhaNoProximoLogin).
   * Confere a senha atual com o mesmo limite do login e derruba as outras sessões.
   */
  async trocarSenha(
    sessao: { id: string; usuario: { id: number; email: string } },
    senhaAtual: string,
    novaSenha: string,
  ): Promise<void> {
    const { id: usuarioId, email } = sessao.usuario;
    this.loginPorEmail.tentar(email);

    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { senhaHash: true },
    });
    if (!(await this.senhas.verificar(senhaAtual, usuario.senhaHash))) {
      throw new BadRequestException('Senha atual incorreta.');
    }
    this.loginPorEmail.desfazer(email);

    const senhaHash = await this.senhas.gerarHash(novaSenha);
    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { senhaHash, trocarSenhaNoProximoLogin: false },
      }),
      this.prisma.sessaoUsuario.updateMany({
        where: { usuarioId, revogadaEm: null, id: { not: sessao.id } },
        data: { revogadaEm: agora },
      }),
      this.prisma.tokenSenha.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: agora },
      }),
    ]);
  }

  /** 429 se este IP já pediu nova senha demais (vale para qualquer e-mail, existente ou não). */
  limitarEsqueciSenha(ip: string): void {
    this.esqueciPorIp.tentar(ip);
  }

  /** Manda o link só se o e-mail for de um usuário ativo; quem chama não fica sabendo se existe. */
  async esqueciSenha(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true, ativo: true },
    });
    if (!usuario?.ativo) return;

    // Evita encher a caixa de e-mail: no máximo um link por minuto
    const recente = await this.prisma.tokenSenha.count({
      where: {
        usuarioId: usuario.id,
        criadoEm: { gt: new Date(Date.now() - INTERVALO_REENVIO_MS) },
      },
    });
    if (recente) return;

    const token = randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + VALIDADE_LINK_MS);

    // O link novo invalida os anteriores; no banco fica só o hash
    await this.prisma.$transaction([
      this.prisma.tokenSenha.updateMany({
        where: { usuarioId: usuario.id, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      this.prisma.tokenSenha.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: hashToken(token),
          finalidade: 'REDEFINIR_SENHA',
          expiraEm,
        },
      }),
    ]);

    const link = `${process.env.FRONTEND_URL ?? 'http://localhost:8080'}/redefinir-senha?token=${token}`;
    const dataLimite = dataHoraLocal(expiraEm);

    const corpoTexto = `Olá, ${usuario.nome}.\n\nPara criar uma nova senha, abra o link abaixo até ${dataLimite}. Ele funciona uma vez só.\n\n${link}\n\nSe você não pediu a troca, ignore este e-mail. Sua senha continua a mesma.`;
    const corpoHtml = gerarTemplateEmailRedefinicao(usuario.nome, link, dataLimite);

    await this.email.enviar(
      usuario.email,
      'Redefinição de senha - Hemocentro',
      corpoTexto,
      corpoHtml,
    );
  }

  /** Troca a senha pelo link do e-mail. O link vale uma vez e todas as sessões abertas caem. */
  async redefinirSenha(token: string, senha: string): Promise<void> {
    const senhaHash = await this.senhas.gerarHash(senha);
    const tokenHash = hashToken(token);
    const agora = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Marca como usado só se ainda valer: dois pedidos com o mesmo link não passam juntos
      const { count } = await tx.tokenSenha.updateMany({
        where: {
          tokenHash,
          usadoEm: null,
          expiraEm: { gt: agora },
          usuario: { ativo: true },
        },
        data: { usadoEm: agora },
      });
      if (!count) {
        throw new BadRequestException(
          'Link inválido ou expirado. Peça um novo.',
        );
      }

      const { usuarioId } = await tx.tokenSenha.findUniqueOrThrow({
        where: { tokenHash },
        select: { usuarioId: true },
      });
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { senhaHash, trocarSenhaNoProximoLogin: false },
      });
      await tx.sessaoUsuario.updateMany({
        where: { usuarioId, revogadaEm: null },
        data: { revogadaEm: agora },
      });
      await tx.tokenSenha.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: agora },
      });
    });
  }
}