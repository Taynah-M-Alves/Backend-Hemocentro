import { dataIso, sanitizarFicha } from './ficha-sanitize.js';

/** O que uma IA deveria devolver para a ficha de exemplo (Fulana Vidal). */
const respostaIa = {
  paciente: {
    nome: 'Fulana Vidal testeIA',
    prontuario: 8934,
    dataNascimento: '1993-05-11',
    racaCor: 'Branco',
    aboRh: 'O+',
    diagnostico: 'Anemia Falciforme',
    nomeMae: 'Marina Tolentino',
  },
  transfusoes: [
    {
      dataEnvio: '05/05/2026',
      tipoHemocomponente: 'CHDF',
      numeroDoacao: '0152 2604 18058',
      grsRhd: 'O Pos',
      volMl: '235',
      testesPai: 'NR',
      provaCruzada: 'nr',
      cidadeDestino: 'Cuiabá',
      ufDestino: 'mt',
      responsavelLiberacao: 'Marcia',
    },
  ],
  pesquisas: [
    {
      data: '2026-09-15',
      gs: 'O',
      rh: 'Positivo',
      tad: 'Negativo',
      pai: 'Negativo',
      autocontrole: 'Negativo',
      interpretacao: null,
      responsavel: 'Nevair B. de Freitas',
    },
  ],
};

describe('sanitizarFicha', () => {
  it('converte a resposta da IA para os tipos do banco', () => {
    const ficha = sanitizarFicha(respostaIa);

    expect(ficha.paciente.nome).toBe('Fulana Vidal');
    expect(ficha.paciente.prontuario).toBe(8934);
    expect(ficha.transfusoes[0]).toMatchObject({
      dataEnvio: '2026-05-05', // dd/mm/aaaa → aaaa-mm-dd
      numeroDoacao: '0152260418058', // só dígitos, zero à esquerda mantido
      volMl: 235, // texto → número
      provaCruzada: 'NR',
      ufDestino: 'MT',
    });
    expect(ficha.pesquisas).toHaveLength(1);
  });

  it('recusa leitura ilegível em vez de gravar dados errados', () => {
    const leituraRuim = {
      paciente: {
        nome: 'CC e',
        dataNascimento: '1002-05-11',
        nomeMae: 'q OX Ih NES',
      },
    };
    expect(() => sanitizarFicha(leituraRuim)).toThrow(
      /nome do paciente e data de nascimento/,
    );
  });

  it('recusa resposta sem paciente', () => {
    expect(() => sanitizarFicha({ transfusoes: [] })).toThrow(/paciente/);
  });
});

describe('dataIso', () => {
  it.each([
    ['11/05/1993', '1993-05-11'],
    ['13.12.2024', '2024-12-13'],
    ['2026-09-15', '2026-09-15'],
    ['31/02/2020', null], // dia que não existe
    ['11/05/1002', null], // ano absurdo
    ['ilegível', null],
  ])('%s → %s', (entrada, esperado) => {
    expect(dataIso(entrada)).toBe(esperado);
  });
});
