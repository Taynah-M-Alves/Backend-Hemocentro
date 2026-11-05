import type { CadastrarFuncionarioDto } from '../dtos/cadastro-funcionario.dto.js';
import { PrismaService } from './prisma.service.js';
import type { SenhaService } from './senha.service.js';
import { UsuarioService } from './usuario.service.js';

describe('UsuarioService — cadastro de funcionário', () => {
  const gerarHash = vi.fn().mockResolvedValue('hash-argon2');
  const senhas = { gerarHash } as unknown as SenhaService;

  it('usa o perfil do DTO, fixa estado inicial, guarda só o hash e exige troca no primeiro acesso', async () => {
    const criar = vi.fn().mockResolvedValue({ id: 2 });

    const prisma = {
      usuario: {
        create: criar,
      },
    } as unknown as PrismaService;

    const service = new UsuarioService(prisma, senhas);

    // Simula campos indevidos chegando diretamente ao service.
    const dados = {
      nome: 'Funcionária de teste',
      email: 'funcionaria@example.invalid',
      perfil: 'GESTOR',
      ativo: false,
      senhaHash: 'hash-injetado',
      trocarSenhaNoProximoLogin: false,
      senha: 'provisoria-123',
    } as unknown as CadastrarFuncionarioDto;

    await service.criar(dados);

    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nome: 'Funcionária de teste',
          email: 'funcionaria@example.invalid',
          colaboradorId: undefined,
          perfil: 'GESTOR',
          ativo: true,
          senhaHash: 'hash-argon2',
          trocarSenhaNoProximoLogin: true,
        },
      }),
    );

    const consulta = criar.mock.calls[0]![0];

    expect(gerarHash).toHaveBeenCalledWith('provisoria-123');
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

    const service = new UsuarioService(prisma, senhas);

    await expect(
      service.criar({
        nome: 'Funcionária de teste',
        email: 'funcionaria@example.invalid',
        colaboradorId: 999,
        senha: 'provisoria-123',
        perfil: 'COLABORADOR',
      }),
    ).rejects.toThrow('Colaborador 999 não está cadastrado.');

    expect(criar).not.toHaveBeenCalled();
  });
});
