import {
  lerLoginDto,
  lerRedefinirSenhaDto,
  lerTrocarSenhaDto,
} from './autenticacao.dto.js';

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

  // A regra de senha nova não vale no login: senhas antigas fora dela continuam entrando
  it.each(['curta', 'Teste 42', '12345678'])(
    'não aplica a regra de senha nova no login: %j',
    (senha) => {
      expect(lerLoginDto({ email: 'teste@example.com', senha }).senha).toBe(
        senha,
      );
    },
  );

  it('rejeita senha com mais de 128 caracteres', () => {
    expect(() =>
      lerLoginDto({ email: 'teste@example.com', senha: 'a'.repeat(129) }),
    ).toThrow('Informe sua senha.');
  });
});

describe('lerTrocarSenhaDto', () => {
  it('aceita senha atual e nova senha válida', () => {
    expect(
      lerTrocarSenhaDto({ senhaAtual: 'Provisoria#1', novaSenha: 'Nova#1234' }),
    ).toEqual({ senhaAtual: 'Provisoria#1', novaSenha: 'Nova#1234' });
  });

  it('exige a senha atual', () => {
    expect(() => lerTrocarSenhaDto({ novaSenha: 'Nova#1234' })).toThrow(
      'Informe a senha atual.',
    );
  });

  it('aplica a regra de senha na nova senha', () => {
    expect(() =>
      lerTrocarSenhaDto({ senhaAtual: 'Provisoria#1', novaSenha: '12345678' }),
    ).toThrow('Esta senha é muito previsível. Escolha outra.');
  });

  it('recusa nova senha igual à atual', () => {
    expect(() =>
      lerTrocarSenhaDto({ senhaAtual: 'Nova#1234', novaSenha: 'Nova#1234' }),
    ).toThrow('A nova senha precisa ser diferente da atual.');
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
