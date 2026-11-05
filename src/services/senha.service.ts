import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class SenhaService {
    async gerarHash(senha: string): Promise<string> {
        return argon2.hash(senha, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
        });
    }

    async verificar(
        senha: string,
        senhaHash: string | null,
    ): Promise<boolean> {
        if (!senhaHash) return false;

        try {
            return await argon2.verify(senhaHash, senha);
        } catch {
            // Um hash inválido não pode autenticar o usuário.
            return false;
        }
    }
}