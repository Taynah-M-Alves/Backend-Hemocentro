import { lerLoginDto } from './autenticacao.dto.js';

describe('lerLoginDto', () => {
  it('normaliza o e-mail e preserva a senha', () => {
    const resultado = lerLoginDto({
      email: '  TESTE@EXAMPLE.COM  ',
      senha: 'Teste#42',
    });

    expect(resultado.email).toBe('teste@example.com');
    expect(resultado.senha).toBe('Teste#42');
  });

  it('rejeita e-mail com formato inválido', () => {
    expect(() =>
      lerLoginDto({
        email: 'email-invalido',
        senha: 'Teste#42',
      }),
    ).toThrow('Informe um e-mail válido.');
  });

  it('rejeita senha ausente', () => {
    expect(() =>
      lerLoginDto({
        email: 'teste@example.com',
      }),
    ).toThrow('Informe sua senha.');
  });

  it.each(['Abc!234', 'Abc!2345678'])(
    'rejeita comprimento fora da faixa: %j',
    (senha) => {
      expect(() =>
        lerLoginDto({
          email: 'teste@example.com',
          senha,
        }),
      ).toThrow('A senha deve ter entre 8 e 10 caracteres.');
    },
  );

  it('rejeita espaços na senha', () => {
    expect(() =>
      lerLoginDto({
        email: 'teste@example.com',
        senha: 'Teste 42',
      }),
    ).toThrow('A senha não pode conter espaços ou quebras de linha.');
  });

  it('rejeita senha da lista de bloqueio', () => {
    expect(() =>
      lerLoginDto({
        email: 'teste@example.com',
        senha: '12345678',
      }),
    ).toThrow('Esta senha é muito previsível. Escolha outra.');
  });
});
