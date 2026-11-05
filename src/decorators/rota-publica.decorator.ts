import { SetMetadata } from '@nestjs/common';

export const ROTA_PUBLICA = 'autenticacao:rota-publica';

export const RotaPublica = () => SetMetadata(ROTA_PUBLICA, true);
