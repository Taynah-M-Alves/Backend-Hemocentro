import { lerAlterarContaDto } from './alteracao-conta.dto.js';

describe('lerAlterarContaDto', () => {
  it('aceita alteração parcial sem acrescentar outros campos', () => {
    expect(lerAlterarContaDto({ permissoes: ['REVISAR_FICHAS'] })).toEqual({
      permissoes: ['REVISAR_FICHAS'],
    });
  });

  it('remove espaços nas extremidades do nome', () => {
    expect(lerAlterarContaDto({ nome: '  Funcionário de teste  ' })).toEqual({
      nome: 'Funcionário de teste',
    });
  });

  it('aceita solicitação de desativação', () => {
    expect(lerAlterarContaDto({ ativo: false })).toEqual({
      ativo: false,
    });
  });

  it('aceita perfil válido', () => {
    expect(lerAlterarContaDto({ perfil: 'GESTOR' })).toEqual({
      perfil: 'GESTOR',
    });
  });

  it('aceita remover todas as permissões', () => {
    expect(lerAlterarContaDto({ permissoes: [] })).toEqual({
      permissoes: [],
    });
  });

  it('aceita remover o vínculo com colaborador', () => {
    expect(lerAlterarContaDto({ colaboradorId: null })).toEqual({
      colaboradorId: null,
    });
  });

  it('remove permissões repetidas', () => {
    expect(
      lerAlterarContaDto({
        permissoes: ['REVISAR_FICHAS', 'REVISAR_FICHAS'],
      }),
    ).toEqual({
      permissoes: ['REVISAR_FICHAS'],
    });
  });

  it('recusa perfil inexistente', () => {
    expect(() => lerAlterarContaDto({ perfil: 'ADMINISTRADOR_TOTAL' })).toThrow(
      'Perfil de usuário inválido.',
    );
  });

  it('recusa permissão inexistente', () => {
    expect(() =>
      lerAlterarContaDto({ permissoes: ['ADMINISTRAR_TUDO'] }),
    ).toThrow('A lista contém uma permissão inválida.');
  });

  it('recusa situação ativa enviada como texto', () => {
    expect(() => lerAlterarContaDto({ ativo: 'false' })).toThrow(
      '"ativo" precisa ser true ou false.',
    );
  });

  it('recusa alteração vazia', () => {
    expect(() => lerAlterarContaDto({})).toThrow(
      'Informe pelo menos um campo para alterar.',
    );
  });

  it('recusa alteração direta do hash da senha', () => {
    expect(() => lerAlterarContaDto({ senhaHash: 'hash-injetado' })).toThrow(
      'O campo "senhaHash" não é permitido na alteração da conta.',
    );
  });
});
