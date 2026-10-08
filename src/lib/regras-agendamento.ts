import type { Role } from './jwt'

export type EstadoAgendamento = 'agendado' | 'concluido' | 'faltou' | 'cancelado'

export function contaBarbeiroAtiva(role: Role, barbeiroAtivo?: boolean | null) {
  return role !== 'barbeiro' || barbeiroAtivo === true
}

export function transicaoStatusPermitida(role: Role, atual: EstadoAgendamento, novo: EstadoAgendamento) {
  if (atual === novo || atual === 'concluido' || atual === 'cancelado') return false
  if (role === 'cliente') return atual === 'agendado' && novo === 'cancelado'
  if (novo === 'cancelado' || novo === 'concluido' || novo === 'faltou') return atual === 'agendado'
  return atual === 'faltou' && novo === 'agendado'
}
