type UsuarioTenant = {
  id: number
  barbeariaId: number
  role: 'cliente' | 'barbeiro' | 'admin'
  barberId?: number
}

export function filtroClientesTenant(usuario: UsuarioTenant) {
  const base = { barbeariaId: usuario.barbeariaId, role: 'cliente' as const }
  if (usuario.role === 'admin') return base
  return {
    ...base,
    OR: [
      { agendamentos: { some: { barbeariaId: usuario.barbeariaId, barberId: usuario.barberId ?? -1 } } },
      { criadoPorId: usuario.id },
    ],
  }
}
