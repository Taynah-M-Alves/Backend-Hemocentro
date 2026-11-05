import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { lerAlterarUsuarioDto } from '../dtos/usuario.dto.js';
import { lerCadastrarFuncionarioDto } from '../dtos/cadastro-funcionario.dto.js';
import { UsuarioService } from '../services/usuario.service.js';
import { SomenteGestorGuard } from '../guards/somente-gestor.guard.js';
import { UsuarioId } from '../decorators/usuario-id.decorator.js';

/** Administração de contas de acesso, exclusiva do gestor. */
@Controller('usuarios')
@UseGuards(SomenteGestorGuard)
export class UsuariosController {
  constructor(private readonly usuarios: UsuarioService) {}

  /** GET /api/usuarios?ativo=true */
  @Get()
  listar(@Query('ativo') ativo?: string) {
    return this.usuarios.listar(ativo !== 'false');
  }

  /** POST /api/usuarios — cria funcionário com senha provisória (troca obrigatória no 1º acesso). */
  @Post()
  criar(@Body() body: unknown) {
    return this.usuarios.criar(lerCadastrarFuncionarioDto(body));
  }

  /** PATCH /api/usuarios/:id — nome, colaboradorId e/ou trocarSenhaNoProximoLogin */
  @Patch(':id')
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.usuarios.alterar(id, lerAlterarUsuarioDto(body));
  }

  /** POST /api/usuarios/:id/inativar — sessão e CSRF checados pelo guard global */
  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  inativar(@Param('id', ParseIntPipe) id: number, @UsuarioId() gestorId: number) {
    return this.usuarios.definirAtivo(id, false, gestorId);
  }

  /** POST /api/usuarios/:id/reativar — sessão e CSRF checados pelo guard global */
  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  reativar(@Param('id', ParseIntPipe) id: number, @UsuarioId() gestorId: number) {
    return this.usuarios.definirAtivo(id, true, gestorId);
  }
}
