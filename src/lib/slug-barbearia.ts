const ROTAS_RESERVADAS = new Set([
  'admin', 'api', 'agendar', 'barbeiro', 'cadastro', 'cliente', 'login',
  'privacidade', 'termos', 'www',
])

export function normalizarSlug(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}

export function slugValido(slug: string) {
  return slug.length >= 3
    && slug.length <= 48
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    && !ROTAS_RESERVADAS.has(slug)
}
