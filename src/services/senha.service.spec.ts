import { SenhaService } from './senha.service.js';

describe('SenhaService', () => {
  const servico = new SenhaService();
  const senhaTeste = 'Teste#42';
  let hash: string;

  beforeAll(async () => {
    hash = await servico.gerarHash(senhaTeste);
  });

  it('aceita a senha correta', async () => {
    const resultado = await servico.verificar(senhaTeste, hash);

    expect(resultado).toBe(true);
  });

  it('rejeita uma senha diferente', async () => {
    const resultado = await servico.verificar(
      'Outra#42',
      hash,
    );

    expect(resultado).toBe(false);
  });

  it('rejeita uma conta sem senha definida', async () => {
    const resultado = await servico.verificar(senhaTeste, null);

    expect(resultado).toBe(false);
  });

  it('rejeita um hash inválido sem lançar erro', async () => {
    const resultado = await servico.verificar(
      senhaTeste,
      'isto-nao-e-um-hash',
    );

    expect(resultado).toBe(false);
  });
});