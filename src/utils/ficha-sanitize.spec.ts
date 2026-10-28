import {
  camposFaltandoNaTransfusao,
  dataIso,
  exigirIdentificacao,
  sanitizarFicha,
} from './ficha-sanitize.js';

/** O que uma IA deveria devolver para a ficha de exemplo (Fulana Vidal). */
const respostaIa = {
  paciente: {
    nome: 'Fulana Vidal',
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
      provaCruzada: 'NAO_REALIZADO',
      grsRhd: 'O_POSITIVO', // "O Pos" → enum do banco
      ufDestino: 'MT',
    });
    expect(ficha.paciente).toMatchObject({ raca: 'BRANCO', aboRh: 'O_POSITIVO' });
    expect(ficha.pesquisas[0]).toMatchObject({
      dataPesquisa: '2026-09-15', // "data" antigo também é aceito
      gs: 'O',
      rh: 'POSITIVO',
    });
  });

  it('aceita o nome do enum, como o PATCH da revisão envia', () => {
    const ficha = sanitizarFicha({
      paciente: { raca: '3', aboRh: 'AB_NEGATIVO', sexo: 'Feminino' },
      kits: [
        {
          tipo: 'ID-DiaPanel',
          data: '10/12/2025',
          resultados: [{ celula: 1, lissCoombs: '0', frio: '2+' }],
        },
      ],
    });
    expect(ficha.paciente).toMatchObject({ raca: 'PARDO', aboRh: 'AB_NEGATIVO', sexo: 'F' });
    expect(ficha.kits[0]).toMatchObject({ tipo: 'DIAPANEL', dataPesquisa: '2025-12-10' });
    expect(ficha.kits[0].resultados[0]).toEqual({
      celula: 1,
      lissCoombs: '0',
      enzima: null,
      frio: '2+',
    });
  });

  it('recusa leitura ilegível em vez de gravar dados errados', () => {
    const leituraRuim = {
      paciente: {
        nome: 'CC e',
        dataNascimento: '1002-05-11',
        nomeMae: 'q OX Ih NES',
      },
    };
    const ficha = sanitizarFicha(leituraRuim);
    expect(ficha.paciente).toMatchObject({ nome: null, dataNascimento: null, nomeMae: null });
    expect(() => exigirIdentificacao(ficha)).toThrow(
      /nome do paciente e data de nascimento/,
    );
  });

  it('distingue NR (não realizado) de campo vazio ou ilegível', () => {
    const ficha = sanitizarFicha({
      transfusoes: [
        { testesPai: 'Não realizado', provaCruzada: null },
        { testesPai: 'NAO_REALIZADO', provaCruzada: '???' },
      ],
    });
    expect(ficha.transfusoes[0]).toMatchObject({ testesPai: 'NAO_REALIZADO', provaCruzada: null });
    expect(ficha.transfusoes[1]).toMatchObject({ testesPai: 'NAO_REALIZADO', provaCruzada: null });
    expect(camposFaltandoNaTransfusao(ficha.transfusoes[0])).toContain('prova cruzada');
  });

  it('recusa resposta que não é objeto', () => {
    expect(() => sanitizarFicha('texto')).toThrow(/objeto/);
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
