'use client'
import { useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import { AdminAgenda, AdminAgendamentos } from '@/components/AdminAreas'

export default function Recepcao() {
  const [visao, setVisao] = useState<'agenda' | 'agendamentos'>('agenda')
  useEffect(() => { const atualizar = () => setVisao(window.location.hash === '#agendamentos' ? 'agendamentos' : 'agenda'); atualizar(); window.addEventListener('hashchange', atualizar); return () => window.removeEventListener('hashchange', atualizar) }, [])
  return <Shell titulo={visao === 'agenda' ? 'Agenda da recepção' : 'Atendimentos'}>{visao === 'agenda' ? <AdminAgenda /> : <div id="agendamentos"><AdminAgendamentos /></div>}</Shell>
}
