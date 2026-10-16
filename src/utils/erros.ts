/** Mensagem legível de qualquer coisa lançada com `throw` (nem sempre é um Error). */
export function mensagemDeErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
