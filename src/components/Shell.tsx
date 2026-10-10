'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { BARBEARIA } from '@/config/barbearia'
import { useAuth } from '@/store/auth'
import { api } from '@/lib/api-client'

type NavItem = { href: string; label: string; end?: boolean; hash?: string }
type Marca = { nome: string; slogan: string; slug: string; corPrimaria: string }

function NavIcon({ label }: { label: string }) {
  const paths: Record<string, ReactNode> = {
    Painel: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    Financeiro: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M15 9.5c-.5-.6-1.4-1-2.6-1-1.5 0-2.5.7-2.5 1.8 0 2.8 5 1.2 5 4 0 1.1-1 1.9-2.6 1.9-1.3 0-2.4-.5-3-1.2" /></>,
    Relatórios: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    Clientes: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-3.5 2.4-5.2 5.5-5.2s5 1.7 5.5 5.2M17 10a2.5 2.5 0 1 0-.2-5M17 14.8c2.2.2 3.5 1.7 3.8 4.2" /></>,
    Agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M13 14h3M8 17h3" /></>,
    Barbeiros: <><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /><path d="M9 15 17 4M15 15 7 4M10 8h4" /></>,
    Serviços: <><path d="m12 3 1.7 4.7L18.5 9l-4.8 1.5L12 15l-1.7-4.5L5.5 9l4.8-1.3L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    Estoque: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
    Agendamentos: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 3v4M16 3v4M8 12h8M8 16h5" /></>,
    Configurações: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.5a7 7 0 0 0-.8-1.8l1.1-1.7-2.1-2.1-1.7 1.1a7 7 0 0 0-1.8-.8L11 3h-3l-.5 2a7 7 0 0 0-1.8.8L4 4.7 1.9 6.8 3 8.5a7 7 0 0 0-.8 1.8l-2 .5v3l2 .5a7 7 0 0 0 .8 1.8l-1.1 1.7L4 20.9l1.7-1.1a7 7 0 0 0 1.8.8l.5 2h3l.5-2a7 7 0 0 0 1.8-.8l1.7 1.1 2.1-2.1-1.1-1.7a7 7 0 0 0 .8-1.8l2-.5Z" /></>,
    'Convites e segurança': <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    Atendimentos: <><path d="M4 5h16v13H7l-3 3V5Z" /><path d="M8 10h8M8 14h5" /></>,
    'Minha comissão': <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /><path d="M19 4v5M16.5 6.5H21.5" /></>,
    Bloqueios: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
    'Plano e cobrança': <><path d="M3 7h18v13H3z" /><path d="M3 11h18M7 16h3M7 4v3M17 4v3" /></>,
  }

  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{paths[label] ?? paths.Agenda}</svg>
}

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
    { href: '/admin/assinatura', label: 'Plano e cobrança', end: true },
    { href: '/admin/dashboard#equipe', label: 'Convites e segurança', end: true, hash: 'equipe' },
  ],
}

export default function Shell({ titulo, children, mainClassName = '', titleClassName = '' }: { titulo: string; children: ReactNode; mainClassName?: string; titleClassName?: string }) {
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
        <Link href="/" className="flex items-center gap-3 px-4 pb-5 pt-1 font-serif text-base tracking-wide text-barber-gold no-underline" aria-label={marca.nome}>
          <span aria-hidden="true" className="h-9 w-9 shrink-0 bg-barber-gold" style={{ mask: "url('/scissors.svg') center / contain no-repeat", WebkitMask: "url('/scissors.svg') center / contain no-repeat" }} />
          <span>{marca.nome}</span>
        </Link>
        <div className="mt-6 mb-2 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500">ESPAÇO DE TRABALHO</div>
        <nav className="app-nav" aria-label="Navegação principal">
          {nav.map((item) => {
            const active = (item.end ? pathname === item.href.split('#')[0] : pathname.startsWith(item.href)) && (item.hash ? hash === item.hash : !hash)
            const className = active
              ? 'flex min-h-11 shrink-0 items-center gap-3 border border-white/75 border-l-4 border-l-barber-gold bg-white/[.025] px-4 font-medium text-barber-gold'
              : 'flex min-h-11 shrink-0 items-center gap-3 border border-transparent px-4 text-gray-400 transition-colors hover:bg-white/5 hover:text-white'
            return item.hash
              ? <a key={item.href} href={item.href} className={className} aria-current={active ? 'page' : undefined}><NavIcon label={item.label} /><span>{item.label}</span></a>
              : <Link key={item.href} href={item.href} onClick={(event) => abrirItem(event, item)} className={className} aria-current={active ? 'page' : undefined}><NavIcon label={item.label} /><span>{item.label}</span></Link>
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <span className="user-avatar">{usuario?.nome?.trim().charAt(0).toLocaleUpperCase() ?? '?'}</span>
          <span className="user-name">{usuario ? usuario.nome : 'Carregando...'}</span>
          <button onClick={logout} className="icon-button" title="Sair" aria-label="Sair">↗</button>
        </div>
      </aside>
      <main className={`app-main ${mainClassName}`}>
        <header className="page-header">
          <div>
            <p className="eyebrow">{usuario?.role === 'admin' ? 'GESTÃO DA BARBEARIA' : usuario?.role === 'barbeiro' ? 'EQUIPE DE CORTE' : usuario?.role === 'recepcionista' ? 'BALCÃO E AGENDA' : 'ÁREA DO CLIENTE'}</p>
            <h1 className={titleClassName}>{titulo}</h1>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer">{marca.nome}<span>·</span>{marca.slogan}</footer>
      </main>
    </div>
  )
}

export function Cartao({ titulo, children, className = '', id, headingClassName = '', titleClassName = '', bodyClassName = '' }: { titulo?: string; children: ReactNode; className?: string; id?: string; headingClassName?: string; titleClassName?: string; bodyClassName?: string }) {
  return (
    <section id={id} className={`panel ${className}`}>
      {titulo && <div className={`panel-heading ${headingClassName}`}><h2 className={titleClassName}>{titulo}</h2></div>}
      <div className={`panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return <div className="kpi"><span className="kpi-label">{titulo}</span><strong className="kpi-value">{valor}</strong>{detalhe && <span className="kpi-detail">{detalhe}</span>}</div>
}

export const STATUS_TXT: Record<string, string> = { agendado: 'Agendado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' }
