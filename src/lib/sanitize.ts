// Remove HTML/caracteres de controle. O React já escapa na saída; isto é defesa em profundidade.
export function limparTexto(s: string, max = 120) {
  return s
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export const somenteDigitos = (s: string) => s.replace(/\D/g, '')
