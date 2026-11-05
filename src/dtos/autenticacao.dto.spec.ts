import { lerLoginDto, lerRedefinirSenhaDto } from './autenticacao.dto.js';

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

describe('lerRedefinirSenhaDto', () => {
  const token = 'a'.repeat(64);

  it('aceita token de 64 hexadecimais e senha válida', () => {
    expect(lerRedefinirSenhaDto({ token, senha: 'Nova#123' })).toEqual({
      token,
      senha: 'Nova#123',
    });
  });

  it.each(['', 'abc', 'G'.repeat(64), 123])('rejeita token %j', (t) => {
    expect(() => lerRedefinirSenhaDto({ token: t, senha: 'Nova#123' })).toThrow(
      'Link inválido ou expirado. Peça um novo.',
    );
  });

  it('aplica a regra de senha', () => {
    expect(() => lerRedefinirSenhaDto({ token, senha: '12345678' })).toThrow(
      'Esta senha é muito previsível. Escolha outra.',
    );
  });
});
