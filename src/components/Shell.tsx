'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { BARBEARIA } from '@/config/barbearia'
import { useAuth } from '@/store/auth'
import { api } from '@/lib/api-client'

type NavItem = { href: string; label: string; end?: boolean; hash?: string }
type Marca = { nome: string; slogan: string; slug: string; corPrimaria: string }

export const campo = 'field'
export const botao = 'button button-primary'
export const botaoSec = 'button button-secondary'
export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export const somaDias = (data: string, n: number) => new Date(Date.parse(data + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
export const dataBR = (d: string) => d.split('-').reverse().join('/')

const NAV: Record<string, NavItem[]> = {
  cliente: [{ href: '/cliente/agendar', label: 'Agendamentos', end: true }],
  barbeiro: [
    { href: '/barbeiro/agenda', label: 'Agenda', end: true },
    { href: '/barbeiro/agenda#comissao', label: 'Minha comissão', end: true, hash: 'comissao' },
    { href: '/barbeiro/agenda#bloqueios', label: 'Bloqueios', end: true, hash: 'bloqueios' },
    { href: '/barbeiro/agenda#clientes', label: 'Clientes', end: true, hash: 'clientes' },
  ],
  recepcionista: [
    { href: '/recepcao/dashboard', label: 'Agenda', end: true },
    { href: '/recepcao/dashboard#agendamentos', label: 'Atendimentos', end: true, hash: 'agendamentos' },
  ],
  admin: [
    { href: '/admin/dashboard', label: 'Painel', end: true },
    { href: '/admin/dashboard#financeiro', label: 'Financeiro', end: true, hash: 'financeiro' },
    { href: '/admin/dashboard#relatorios', label: 'Relatórios', end: true, hash: 'relatorios' },
    { href: '/admin/dashboard#clientes', label: 'Clientes', end: true, hash: 'clientes' },
    { href: '/admin/dashboard#agenda', label: 'Agenda', end: true, hash: 'agenda' },
    { href: '/admin/dashboard#barbeiros', label: 'Barbeiros', end: true, hash: 'barbeiros' },
    { href: '/admin/dashboard#servicos', label: 'Serviços', end: true, hash: 'servicos' },
    { href: '/admin/dashboard#estoque', label: 'Estoque', end: true, hash: 'estoque' },
    { href: '/admin/dashboard#agendamentos', label: 'Agendamentos', end: true, hash: 'agendamentos' },
    { href: '/admin/dashboard#configuracoes', label: 'Configurações', end: true, hash: 'configuracoes' },
    { href: '/admin/dashboard#equipe', label: 'Convites e segurança', end: true, hash: 'equipe' },
  ],
}

export default function Shell({ titulo, children }: { titulo: string; children: ReactNode }) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  const [marca, setMarca] = useState<Marca>({ nome: BARBEARIA.nome, slogan: BARBEARIA.slogan, slug: '', corPrimaria: BARBEARIA.cores.primaria })
  const { usuario, carregar, logout } = useAuth()
  useEffect(() => {
    carregar()
    const atualizarHash = () => setHash(window.location.hash.slice(1))
    atualizarHash()
    window.addEventListener('hashchange', atualizarHash)
    return () => window.removeEventListener('hashchange', atualizarHash)
  }, [carregar])
  const usuarioId = usuario?.id
  useEffect(() => {
    if (!usuarioId) return
    api<{ barbearia: Marca }>('/api/catalogo').then((r) => {
      if (r.ok && r.data?.barbearia) setMarca(r.data.barbearia)
    })
  }, [usuarioId])
  const nav = usuario ? NAV[usuario.role] ?? [] : []

  function abrirItem(event: MouseEvent<HTMLAnchorElement>, item: NavItem) {
    // No mesmo painel, o Link do Next pode preservar a hash atual. Limpamos e
    // notificamos os componentes que escolhem a visão pela hash da URL.
    if (!item.hash && pathname === item.href && window.location.hash) {
      event.preventDefault()
      window.history.pushState(null, '', item.href)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="brand-lockup" aria-label={marca.nome}>
          <Image src={BARBEARIA.logo} alt="" width={34} height={34} />
          <span>{marca.nome}</span>
        </Link>
        <div className="sidebar-caption">ESPAÇO DE TRABALHO</div>
        <nav className="app-nav" aria-label="Navegação principal">
          {nav.map((item) => {
            const active = (item.end ? pathname === item.href.split('#')[0] : pathname.startsWith(item.href)) && (item.hash ? hash === item.hash : !hash)
            const className = `nav-link${active ? ' is-active' : ''}`
            return item.hash
              ? <a key={item.href} href={item.href} className={className} aria-current={active ? 'page' : undefined}>{item.label}</a>
              : <Link key={item.href} href={item.href} onClick={(event) => abrirItem(event, item)} className={className} aria-current={active ? 'page' : undefined}>{item.label}</Link>
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <span className="user-avatar">{usuario?.nome?.trim().charAt(0).toLocaleUpperCase() ?? '?'}</span>
          <span className="user-name">{usuario ? usuario.nome : 'Carregando...'}</span>
          <button onClick={logout} className="icon-button" title="Sair" aria-label="Sair">↗</button>
        </div>
      </aside>
      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">{usuario?.role === 'admin' ? 'GESTÃO' : usuario?.role === 'barbeiro' ? 'EQUIPE' : usuario?.role === 'recepcionista' ? 'RECEPÇÃO' : 'ÁREA DO CLIENTE'}</p>
            <h1>{titulo}</h1>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer">{marca.nome}<span>·</span>{marca.slogan}</footer>
      </main>
    </div>
  )
}

export function Cartao({ titulo, children, className = '', id }: { titulo?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`panel ${className}`}>
      {titulo && <div className="panel-heading"><h2>{titulo}</h2></div>}
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return <div className="kpi"><span className="kpi-label">{titulo}</span><strong className="kpi-value">{valor}</strong>{detalhe && <span className="kpi-detail">{detalhe}</span>}</div>
}

export const STATUS_TXT: Record<string, string> = { agendado: 'Agendado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' }
