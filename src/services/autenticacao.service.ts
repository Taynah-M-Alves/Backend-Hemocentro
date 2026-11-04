import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service.js';
import { SenhaService } from './senha.service.js';
import { SessaoService } from './sessao.service.js';

@Injectable()
export class AutenticacaoService implements OnModuleInit {
  private hashInexistente!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly sessoes: SessaoService,
  ) {}

  async onModuleInit(): Promise<void> {
    const senhaAleatoria = randomBytes(32).toString('hex');
    this.hashInexistente = await this.senhas.gerarHash(senhaAleatoria);
  }

  async entrar(email: string, senha: string) {
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
      },
    });

    const senhaValida = await this.senhas.verificar(
      senha,
      usuario?.senhaHash ?? this.hashInexistente,
    );

    if (!usuario || !usuario.ativo || !usuario.senhaHash || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const sessao = await this.sessoes.criar(usuario.id);

    return {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        permissoes: usuario.permissoes,
      },
      sessao,
    };
  }
}
