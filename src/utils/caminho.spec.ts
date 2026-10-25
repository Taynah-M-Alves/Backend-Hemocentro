import { gravarCaminho, lerCaminho, partesDoCaminho } from './caminho.js';

describe('caminho do campo', () => {
  const dados = () => ({
    paciente: { nomeMae: null as string | null },
    transfusoes: [{ volMl: 1 }, { volMl: 2 }],
  });

  it('lê e grava pelo caminho', () => {
    const d = dados();
    const partes = partesDoCaminho('transfusoes[1].volMl');
    expect(partes).toEqual(['transfusoes', 1, 'volMl']);
    gravarCaminho(d, partes, 252);
    expect(lerCaminho(d, partes)).toBe(252);
  });

  it('acrescenta item no fim da lista e remove com null', () => {
    const d = dados();
    gravarCaminho(d, partesDoCaminho('transfusoes[2]'), { volMl: 3 });
    expect(d.transfusoes).toHaveLength(3);
    gravarCaminho(d, partesDoCaminho('transfusoes[0]'), null);
    expect(d.transfusoes.map((t) => t.volMl)).toEqual([2, 3]);
  });

  it('recusa campo que não existe ou caminho mal formado', () => {
    expect(() => gravarCaminho(dados(), partesDoCaminho('paciente.inventado'), 1)).toThrow(/não existe/);
    expect(() => gravarCaminho(dados(), partesDoCaminho('transfusoes[5]'), {})).toThrow(/não existe/);
    expect(() => partesDoCaminho('paciente..nome')).toThrow(/inválido/);
    expect(() => partesDoCaminho('__proto__.x')).toThrow(/inválido/);
  });
});
