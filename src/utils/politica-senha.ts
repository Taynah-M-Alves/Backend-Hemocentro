import { BadRequestException } from '@nestjs/common';

// Lista inicial. Deve ser ampliada com uma lista mantida
// de senhas comuns ou comprometidas antes da publicação.
const SENHAS_BLOQUEADAS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'qwerty123',
  'senha123',
  'senha1234',
  'hemocentro',
]);

export function validarNovaSenha(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new BadRequestException('Informe a nova senha.');
  }

  if (/[\p{Cc}\p{Cf}]/u.test(valor)) {
    throw new BadRequestException(
      'A senha não pode conter caracteres de controle ou formatação invisíveis.',
    );
  }

  const tamanho = Array.from(valor).length;

  // Frases-senha são bem-vindas (NIST SP 800-63B): até 64 caracteres, com espaços
  if (tamanho < 8 || tamanho > 64) {
    throw new BadRequestException(
      'A senha deve ter entre 8 e 64 caracteres.',
    );
  }

  if (SENHAS_BLOQUEADAS.has(valor.toLowerCase())) {
    throw new BadRequestException(
      'Esta senha é muito previsível. Escolha outra.',
    );
  }

  // Espaço não conta como caractere especial
  if (
    !/\p{Ll}/u.test(valor) ||
    !/\p{Lu}/u.test(valor) ||
    !/\d/.test(valor) ||
    !/[^\p{L}\p{N}\s]/u.test(valor)
  ) {
    throw new BadRequestException(
      'A senha deve ter pelo menos uma letra minúscula, uma maiúscula, um número e um caractere especial.',
    );
  }

  return valor;
}