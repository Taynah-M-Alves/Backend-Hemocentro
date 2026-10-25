import { nomeProprio } from './formatos.js';

describe('nomeProprio', () => {
  it('capitaliza, junta espaços e mantém preposições minúsculas', () => {
    expect(nomeProprio('  MARIA  DA silva e souza ')).toBe(
      'Maria da Silva e Souza',
    );
    expect(nomeProprio('de oliveira')).toBe('De Oliveira');
    expect(nomeProprio('ângela')).toBe('Ângela');
  });
});
