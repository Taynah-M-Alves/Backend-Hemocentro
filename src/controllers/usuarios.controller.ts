import {
  Body,
  Controller,
  Get,
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

  /** POST /api/usuarios — cria funcionário sem senha definida. */
  @Post()
  criar(@Body() body: unknown) {
    return this.usuarios.criar(lerCadastrarFuncionarioDto(body));
  }

  /** PATCH /api/usuarios/:id — nome, ativo e/ou colaboradorId */
  @Patch(':id')
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.usuarios.alterar(id, lerAlterarUsuarioDto(body));
  }
}
