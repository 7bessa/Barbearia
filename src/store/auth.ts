import { create } from 'zustand'
import { api } from '@/lib/api-client'

export type Usuario = { id: number; nome: string; email: string; role: 'cliente' | 'barbeiro' | 'recepcionista' | 'admin'; barberId?: number }
type Resp = { usuario?: Usuario; erro?: string }
type Cadastro = { nome: string; telefone: string; email: string; senha: string; aceitoTermos: boolean; role?: 'cliente' | 'barbeiro' | 'recepcionista'; codigoConvite?: string }

// Só estado em memória (sem persist/localStorage). A fonte da verdade é o cookie httpOnly no servidor.
type Estado = {
  usuario: Usuario | null
  pronto: boolean
  carregar: () => Promise<void>
  login: (email: string, senha: string) => Promise<string | null> // retorna mensagem de erro ou null
  cadastrar: (d: Cadastro) => Promise<string | null>
  logout: () => Promise<void>
}

export const useAuth = create<Estado>((set) => ({
  usuario: null,
  pronto: false,
  async carregar() {
    const r = await api<Resp>('/api/auth/me')
    set({ usuario: r.ok ? r.data?.usuario ?? null : null, pronto: true })
  },
  async login(email, senha) {
    const r = await api<Resp>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) })
    if (!r.ok || !r.data?.usuario) return r.data?.erro ?? 'Erro interno'
    set({ usuario: r.data.usuario })
    return null
  },
  async cadastrar(d) {
    const r = await api<Resp>('/api/auth/cadastro', { method: 'POST', body: JSON.stringify(d) })
    if (!r.ok || !r.data?.usuario) return r.data?.erro ?? 'Erro interno'
    set({ usuario: r.data.usuario })
    return null
  },
  async logout() {
    await api('/api/auth/logout', { method: 'POST' })
    set({ usuario: null })
    window.location.href = '/login'
  },
}))
