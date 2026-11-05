import { HttpException, HttpStatus } from '@nestjs/common';
import { horaLocal } from './formatos.js';

/**
 * Conta tentativas por chave (IP, e-mail...) na memória do servidor.
 * Ao chegar em `maximo`, a chave fica bloqueada por `janelaMs` a partir da última tentativa.
 */
export class LimiteTentativas {
  private readonly contagem = new Map<string, { total: number; ate: number }>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly mensagem: string,
  ) {}

  /** Conta mais uma tentativa; se a chave já gastou as dela, responde 429 e não conta. */
  tentar(chave: string): void {
    const agora = Date.now();
    const atual = this.contagem.get(chave);

    if (!atual || atual.ate <= agora) {
      this.limparVencidas(agora);
      this.contagem.set(chave, { total: 1, ate: agora + this.janelaMs });
      return;
    }
    if (atual.total >= this.maximo) {
      const ate = new Date(atual.ate);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `${this.mensagem} Tente novamente às ${horaLocal(ate)}.`,
          tentarNovamenteEm: ate,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    atual.total++;
    if (atual.total >= this.maximo) atual.ate = agora + this.janelaMs;
  }

  /** Devolve a tentativa (ex.: login certo não conta). */
  desfazer(chave: string): void {
    const atual = this.contagem.get(chave);
    if (atual && --atual.total <= 0) this.contagem.delete(chave);
  }

  /** Não deixa o mapa crescer para sempre com chaves que já venceram. */
  private limparVencidas(agora: number): void {
    if (this.contagem.size < 1000) return;
    for (const [chave, { ate }] of this.contagem) {
      if (ate <= agora) this.contagem.delete(chave);
    }
  }
}
