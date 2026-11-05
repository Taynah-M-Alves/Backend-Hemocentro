import { SetMetadata } from '@nestjs/common';

export const ROTA_PUBLICA = 'autenticacao:rota-publica';

export const RotaPublica = () => SetMetadata(ROTA_PUBLICA, true);

export const LIBERADA_NA_TROCA_DE_SENHA = 'autenticacao:liberada-na-troca-de-senha';

/** Rota que quem ainda precisa trocar a senha (trocarSenhaNoProximoLogin) pode usar. */
export const LiberadaNaTrocaDeSenha = () =>
  SetMetadata(LIBERADA_NA_TROCA_DE_SENHA, true);
