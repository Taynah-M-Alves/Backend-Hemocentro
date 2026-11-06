import { validarNovaSenha } from './politica-senha.js';

describe('validarNovaSenha', () => {
  it.each(['Abc!2345', 'Abc!23456', 'Abc!234567', 'Árvore#1'])(
    'aceita uma senha válida sem modificá-la: %j',
    (senha) => {
      expect(validarNovaSenha(senha)).toBe(senha);
    },
  );

  it.each(['Minha frase de acesso 2!', 'Abc! 2345', 'Aa1!'.repeat(16)])(
    'aceita frases-senha com espaços e até 64 caracteres: %j',
    (senha) => {
      expect(validarNovaSenha(senha)).toBe(senha);
    },
  );

  it.each(['Abc!\t2345', 'Abc!\n2345'])(
    'rejeita tabulação e quebra de linha: %j',
    (senha) => {
      expect(() => validarNovaSenha(senha)).toThrow(
        'A senha não pode conter caracteres de controle ou formatação invisíveis.',
      );
    },
  );

  it.each(['Abc!234', 'a'.repeat(65)])(
    'rejeita comprimento fora da faixa: %j',
    (senha) => {
      expect(() => validarNovaSenha(senha)).toThrow(
        'A senha deve ter entre 8 e 64 caracteres.',
      );
    },
  );

  it('rejeita senha da lista de bloqueio', () => {
    expect(() => validarNovaSenha('12345678')).toThrow(
      'Esta senha é muito previsível. Escolha outra.',
    );
  });

  it.each(['abc!2345', 'ABC!2345', 'Abcd!efg', 'Abcd2345', 'Abc 2345'])(
    'rejeita senha sem minúscula, maiúscula, número ou caractere especial: %j',
    (senha) => {
      expect(() => validarNovaSenha(senha)).toThrow(
        'A senha deve ter pelo menos uma letra minúscula, uma maiúscula, um número e um caractere especial.',
      );
    },
  );

  it('rejeita caracteres invisíveis de formatação', () => {
    expect(() => validarNovaSenha('Abc!\u200B2345')).toThrow(
      'A senha não pode conter caracteres de controle ou formatação invisíveis.',
    );
  });

  it('rejeita valor que não seja texto', () => {
    expect(() => validarNovaSenha(12345678)).toThrow('Informe a nova senha.');
  });
});
