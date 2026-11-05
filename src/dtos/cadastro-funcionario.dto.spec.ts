import { lerCadastrarFuncionarioDto } from './cadastro-funcionario.dto.js';

const cadastroValido = () => ({
  nome: 'Funcionária de teste',
  email: 'funcionaria@example.invalid',
  senha: 'provisoria-123',
});

describe('lerCadastrarFuncionarioDto', () => {
  it('normaliza o e-mail', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      email: '  FUNCIONARIA@EXAMPLE.INVALID  ',
    });

    expect(resultado.email).toBe('funcionaria@example.invalid');
  });

  it('aceita vínculo com colaborador', () => {
    const resultado = lerCadastrarFuncionarioDto({
      ...cadastroValido(),
      colaboradorId: 2,
    });

    expect(resultado.colaboradorId).toBe(2);
  });

  it('exige a senha e aplica a política de senha', () => {
    const { senha: _senha, ...semSenha } = cadastroValido();
    expect(() => lerCadastrarFuncionarioDto(semSenha)).toThrow(
      'Informe a nova senha.',
    );
    expect(() =>
      lerCadastrarFuncionarioDto({ ...cadastroValido(), senha: '1234567' }),
    ).toThrow('A senha deve ter entre 8 e 64 caracteres.');
  });

  it.each(['perfil', 'permissoes', 'senhaHash', 'ativo', 'trocarSenhaNoProximoLogin'])(
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
