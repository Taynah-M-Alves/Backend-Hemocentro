import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  lerAlterarUsuarioDto,
  lerCriarUsuarioDto,
} from '../dtos/usuario.dto.js';
import { UsuarioService } from '../services/usuario.service.js';

// Sem tela no design. Não exige X-Usuario-Id porque é por aqui que o primeiro usuário
// é criado (provisório até existir login).
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuarioService) {}

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

  /** PATCH /api/usuarios/:id — nome, ativo e/ou colaboradorId */
  @Patch(':id')
  alterar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.usuarios.alterar(id, lerAlterarUsuarioDto(body));
  }
}
