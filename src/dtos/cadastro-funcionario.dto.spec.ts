import { lerCadastrarFuncionarioDto } from './cadastro-funcionario.dto.js';

const cadastroValido = () => ({
  nome: 'Funcionária de teste',
  email: 'funcionaria@example.invalid',
  permissoes: ['REVISAR_FICHAS'],
});

describe('lerCadastrarFuncionarioDto', () => {
  it('normaliza o e-mail e aceita permissões válidas', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      email: '  FUNCIONARIA@EXAMPLE.INVALID  ',
    });

    expect(resultado.email).toBe('funcionaria@example.invalid');
    expect(resultado.permissoes).toEqual(['REVISAR_FICHAS']);
  });

  it('aceita vínculo com colaborador', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      colaboradorId: 2,
    });

    expect(resultado.colaboradorId).toBe(2);
  });

  it('permite cadastro sem permissões operacionais', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      permissoes: [],
    });

    expect(resultado.permissoes).toEqual([]);
  });

  it('remove permissões repetidas', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      permissoes: ['REVISAR_FICHAS', 'REVISAR_FICHAS'],
    });

    expect(resultado.permissoes).toEqual(['REVISAR_FICHAS']);
  });

  it('rejeita permissão desconhecida', () => {
    expect(() =>
      lerCadastrarFuncionarioDto({
        ...cadastroValido(),
        permissoes: ['ADMINISTRAR_TUDO'],
      }),
    ).toThrow('A lista contém uma permissão inválida.');
  });

  it('exige uma lista de permissões', () => {
    expect(() =>
      lerCadastrarFuncionarioDto({
        ...cadastroValido(),
        permissoes: 'REVISAR_FICHAS',
      }),
    ).toThrow('"permissoes" precisa ser uma lista.');
  });

  it.each(['perfil', 'senha', 'senhaHash', 'ativo'])(
    'rejeita o campo não permitido: %s',
    (campo) => {
      expect(() =>
        lerCadastrarFuncionarioDto({
          ...cadastroValido(),
          [campo]: 'valor indevido',
        }),
      ).toThrow(`O campo "${campo}" não é permitido`);
    },
  );
});
