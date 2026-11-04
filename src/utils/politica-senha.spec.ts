import { validarNovaSenha } from './politica-senha.js';

describe('validarNovaSenha', () => {
  it.each(['Abc!2345', 'Abc!23456', 'Abc!234567', 'Árvore#1'])(
    'aceita uma senha válida sem modificá-la: %j',
    (senha) => {
      expect(validarNovaSenha(senha)).toBe(senha);
    },
  );

  it.each([' Abc!2345', 'Abc!2345 ', 'Abc! 2345', 'Abc!\t2345', 'Abc!\n2345'])(
    'rejeita espaços em branco: %j',
    (senha) => {
      expect(() => validarNovaSenha(senha)).toThrow(
        'A senha não pode conter espaços ou quebras de linha.',
      );
    },
  );

  it.each(['Abc!234', 'Abc!2345678'])(
    'rejeita comprimento fora da faixa: %j',
    (senha) => {
      expect(() => validarNovaSenha(senha)).toThrow(
        'A senha deve ter entre 8 e 10 caracteres.',
      );
    },
  );

  it('rejeita senha da lista de bloqueio', () => {
    expect(() => validarNovaSenha('12345678')).toThrow(
      'Esta senha é muito previsível. Escolha outra.',
    );
  });

  it('rejeita caracteres invisíveis de formatação', () => {
    expect(() => validarNovaSenha('Abc!\u200B2345')).toThrow(
      'A senha não pode conter caracteres de controle ou formatação invisíveis.',
    );
  });

  it('rejeita valor que não seja texto', () => {
    expect(() => validarNovaSenha(12345678)).toThrow('Informe a nova senha.');
  });
});
