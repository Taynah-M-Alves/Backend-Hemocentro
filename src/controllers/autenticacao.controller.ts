import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  lerEsqueciSenhaDto,
  lerLoginDto,
  lerRedefinirSenhaDto,
} from '../dtos/autenticacao.dto.js';
import { AutenticacaoService } from '../services/autenticacao.service.js';
import { SessaoService } from '../services/sessao.service.js';
import { timingSafeEqual } from 'node:crypto';
import { RotaPublica } from '../decorators/rota-publica.decorator.js';

@Controller('auth')
export class AutenticacaoController {
  constructor(
    private readonly autenticacao: AutenticacaoService,
    private readonly sessoes: SessaoService,
  ) {}

  @RotaPublica()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Headers('origin') origem: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const origensPermitidas = (
      process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081'
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (origem && !origensPermitidas.includes(origem)) {
      throw new ForbiddenException('Origem não permitida.');
    }

    const { email, senha } = lerLoginDto(body);

    const { usuario, sessao } = await this.autenticacao.entrar(email, senha);

    resposta.cookie('hemocentro_sessao', sessao.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: Math.max(0, sessao.expiraEm.getTime() - Date.now()),
    });

    return {
      usuario,
      csrfToken: sessao.csrfToken,
      expiraEm: sessao.expiraEm,
    };
  }

  @Get('sessao')
  @Header('Cache-Control', 'no-store')
  async consultarSessao(@Req() requisicao: Request) {
    const valorCookie: unknown = requisicao.cookies?.hemocentro_sessao;

    const token = typeof valorCookie === 'string' ? valorCookie : undefined;

    const sessao = await this.sessoes.buscar(token);

    if (!sessao) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    return {
      usuario: {
        id: sessao.usuario.id,
        nome: sessao.usuario.nome,
        email: sessao.usuario.email,
        perfil: sessao.usuario.perfil,
        permissoes: sessao.usuario.permissoes,
      },
      csrfToken: sessao.csrfToken,
      expiraEm: sessao.expiraEm,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() requisicao: Request,
    @Headers('origin') origem: string | undefined,
    @Headers('x-csrf-token') csrfRecebido: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    const origensPermitidas = (
      process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081'
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (origem && !origensPermitidas.includes(origem)) {
      throw new ForbiddenException('Origem não permitida.');
    }

    const valorCookie: unknown = requisicao.cookies?.hemocentro_sessao;
    const token = typeof valorCookie === 'string' ? valorCookie : undefined;

    const sessao = await this.sessoes.buscar(token);

    if (!sessao) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    if (
      typeof csrfRecebido !== 'string' ||
      !/^[a-f0-9]{64}$/.test(csrfRecebido)
    ) {
      throw new ForbiddenException('Token de proteção inválido.');
    }

    const recebido = Buffer.from(csrfRecebido, 'utf8');
    const esperado = Buffer.from(sessao.csrfToken, 'utf8');

    if (
      recebido.length !== esperado.length ||
      !timingSafeEqual(recebido, esperado)
    ) {
      throw new ForbiddenException('Token de proteção inválido.');
    }

    await this.sessoes.revogar(token);

    resposta.clearCookie('hemocentro_sessao', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
    });
  }

  @RotaPublica()
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  esqueciSenha(@Body() body: unknown) {
    // Sem await: a resposta sai no mesmo tempo, exista ou não o e-mail
    this.autenticacao
      .esqueciSenha(lerEsqueciSenhaDto(body))
      .catch((erro: unknown) =>
        Logger.error(`Falha no esqueci-senha: ${String(erro)}`, 'Autenticacao'),
      );
    return {
      message:
        'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.',
    };
  }

  @RotaPublica()
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async redefinirSenha(@Body() body: unknown) {
    const { token, senha } = lerRedefinirSenhaDto(body);
    await this.autenticacao.redefinirSenha(token, senha);
    return { message: 'Senha alterada. Entre com a nova senha.' };
  }
}
