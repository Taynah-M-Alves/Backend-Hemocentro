import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  lerAlterarUsuarioDto,
  lerCriarUsuarioDto,
} from '../dtos/usuario.dto.js';
import { SessaoService, tokenDoCookie } from '../services/sessao.service.js';
import { UsuarioService } from '../services/usuario.service.js';

// Sem tela no design. Não exige X-Usuario-Id porque é por aqui que o primeiro usuário
// é criado (provisório até existir login).
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuarioService,
    private readonly sessoes: SessaoService,
  ) {}

  /** GET /api/usuarios?ativo=true */
  @Get()
  listar(@Query('ativo') ativo?: string) {
    return this.usuarios.listar(ativo !== 'false');
  }

  /** POST /api/usuarios — 201; 409 se o email já existir */
  @Post()
  criar(@Body() body: unknown) {
    return this.usuarios.criar(lerCriarUsuarioDto(body));
  }

  /** PATCH /api/usuarios/:id — nome e/ou colaboradorId */
  @Patch(':id')
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.usuarios.alterar(id, lerAlterarUsuarioDto(body));
  }

  /** POST /api/usuarios/:id/inativar — só gestor logado (cookie + X-CSRF-Token) */
  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  async inativar(
    @Param('id', ParseIntPipe) id: number,
    @Req() requisicao: Request,
    @Headers('x-csrf-token') csrf: string | undefined,
  ) {
    const gestorId = await this.exigirGestor(requisicao, csrf);
    return this.usuarios.definirAtivo(id, false, gestorId);
  }

  /** POST /api/usuarios/:id/reativar — só gestor logado (cookie + X-CSRF-Token) */
  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  async reativar(
    @Param('id', ParseIntPipe) id: number,
    @Req() requisicao: Request,
    @Headers('x-csrf-token') csrf: string | undefined,
  ) {
    const gestorId = await this.exigirGestor(requisicao, csrf);
    return this.usuarios.definirAtivo(id, true, gestorId);
  }

  private async exigirGestor(requisicao: Request, csrf: string | undefined) {
    const { usuario } = await this.sessoes.exigir(tokenDoCookie(requisicao), csrf);
    if (usuario.perfil !== 'GESTOR') {
      throw new ForbiddenException('Só gestores podem desativar ou reativar usuários.');
    }
    return usuario.id;
  }
}
