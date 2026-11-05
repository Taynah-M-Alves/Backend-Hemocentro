import type { CadastrarFuncionarioDto } from '../dtos/cadastro-funcionario.dto.js';
import { PrismaService } from './prisma.service.js';
import { UsuarioService } from './usuario.service.js';

describe('UsuarioService — cadastro de funcionário', () => {
  it('fixa perfil, estado inicial e ausência de senha no servidor', async () => {
    const criar = vi.fn().mockResolvedValue({ id: 2 });

    const prisma = {
      usuario: {
        create: criar,
      },
    } as unknown as PrismaService;

    const service = new UsuarioService(prisma);

    // Simula campos indevidos chegando diretamente ao service.
    const dados = {
      nome: 'Funcionária de teste',
      email: 'funcionaria@example.invalid',
      permissoes: ['REVISAR_FICHAS'],
      perfil: 'GESTOR',
      ativo: false,
      senhaHash: 'hash-injetado',
    } as unknown as CadastrarFuncionarioDto;

    await service.criar(dados);

    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nome: 'Funcionária de teste',
          email: 'funcionaria@example.invalid',
          colaboradorId: undefined,
          permissoes: ['REVISAR_FICHAS'],
          perfil: 'COLABORADOR',
          ativo: true,
          senhaHash: null,
        },
      }),
    );

    const consulta = criar.mock.calls[0]![0];

    expect(consulta.select).not.toHaveProperty('senhaHash');
  });

  it('não cria conta vinculada a colaborador inexistente', async () => {
    const criar = vi.fn();
    const buscarColaborador = vi.fn().mockResolvedValue(null);

    const prisma = {
      usuario: {
        create: criar,
      },
      colaborador: {
        findUnique: buscarColaborador,
      },
    } as unknown as PrismaService;

    const service = new UsuarioService(prisma);

    await expect(
      service.criar({
        nome: 'Funcionária de teste',
        email: 'funcionaria@example.invalid',
        colaboradorId: 999,
        permissoes: [],
      }),
    ).rejects.toThrow('Colaborador 999 não está cadastrado.');

    expect(criar).not.toHaveBeenCalled();
  });
});
