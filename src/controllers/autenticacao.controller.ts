import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
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
  lerTrocarSenhaDto,
} from '../dtos/autenticacao.dto.js';
import { AutenticacaoService } from '../services/autenticacao.service.js';
import { SessaoService, tokenDoCookie } from '../services/sessao.service.js';
import {
  LiberadaNaTrocaDeSenha,
  RotaPublica,
} from '../decorators/rota-publica.decorator.js';
import type { RequisicaoAutenticada } from '../guards/autenticacao.guard.js';
import { origensPermitidas } from '../utils/origens.js';

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
    @Ip() ip: string,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const origens = origensPermitidas();

    if (origem && !origens.includes(origem)) {
      throw new ForbiddenException('Origem não permitida.');
    }

    const { email, senha } = lerLoginDto(body);

    const { usuario, sessao } = await this.autenticacao.entrar(email, senha, ip);

    resposta.cookie('hemocentro_sessao', sessao.token, {
      httpOnly: true,
      secure: true, // os navegadores aceitam Secure em http://localhost
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

  @LiberadaNaTrocaDeSenha()
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
        trocarSenhaNoProximoLogin: sessao.usuario.trocarSenhaNoProximoLogin,
      },
      csrfToken: sessao.csrfToken,
      expiraEm: sessao.expiraEm,
    };
  }

  @LiberadaNaTrocaDeSenha()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() requisicao: Request,
    @Headers('origin') origem: string | undefined,
    @Headers('x-csrf-token') csrfRecebido: string | undefined,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    const origens = origensPermitidas();

    if (origem && !origens.includes(origem)) {
      throw new ForbiddenException('Origem não permitida.');
    }

    const token = tokenDoCookie(requisicao);
    await this.sessoes.exigir(token, csrfRecebido);
    await this.sessoes.revogar(token);

    resposta.clearCookie('hemocentro_sessao', {
      httpOnly: true,
      secure: true, // os navegadores aceitam Secure em http://localhost
      sameSite: 'lax',
      path: '/api',
    });
  }

  /** Sessão, origem e CSRF já conferidos pelo guard global. */
  @LiberadaNaTrocaDeSenha()
  @Post('trocar-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async trocarSenha(@Body() body: unknown, @Req() requisicao: RequisicaoAutenticada) {
    const { senhaAtual, novaSenha } = lerTrocarSenhaDto(body);
    await this.autenticacao.trocarSenha(
      requisicao.sessaoAutenticada!,
      senhaAtual,
      novaSenha,
    );
    return { message: 'Senha alterada.' };
  }

  @RotaPublica()
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  esqueciSenha(@Body() body: unknown, @Ip() ip: string) {
    const email = lerEsqueciSenhaDto(body);
    this.autenticacao.limitarEsqueciSenha(ip);
    // Sem await: a resposta sai no mesmo tempo, exista ou não o e-mail
    this.autenticacao
      .esqueciSenha(email)
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
