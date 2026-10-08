// Regras de horário PURAS (sem banco): fáceis de testar. O acesso ao banco fica em db.ts.
import { BARBEARIA } from '@/config/barbearia'

export type Horario = { abre: string; fecha: string; almocoIni: string | null; almocoFim: string | null; dias: number[] }
export type Contexto = {
  horario: Horario
  bloqueios: { ini: string; fim: string }[] // do barbeiro, na data
  ocupados: { hora: string; dur: number }[] // agendamentos não cancelados do barbeiro, na data
  agora?: string // 'YYYY-MM-DD HH:MM' (para testes)
}

// 'YYYY-MM-DD HH:MM' no fuso de Brasília
export const agoraBR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 16)
export const jaPassou = (a: { data: string; hora: string }) => `${a.data} ${a.hora}` <= agoraBR()
export const tm = (h: string) => { const [a, b] = h.split(':'); return +a * 60 + +b }
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const dataValida = (s: string) => {
  const d = Date.parse(s + 'T00:00:00Z')
  return !isNaN(d) && new Date(d).toISOString().slice(0, 10) === s
}
// Minutos entre agora (Brasília) e o início do atendimento; negativo = já começou.
export const minutosAte = (a: { data: string; hora: string }, agora = agoraBR()) =>
  (Date.parse(`${a.data}T${a.hora}:00Z`) - Date.parse(`${agora.replace(' ', 'T')}:00Z`)) / 60000

// Retorna o motivo da recusa ou null. "staff" (barbeiro/dono) pode encaixar horários de hoje que já começaram,
// de 5 em 5 min, e agendar até 60 dias à frente. O cliente usa a grade de passoMinutos e até 14 dias.
export function regraHorario(c: Contexto, data: string, hora: string, dur: number, staff = false): string | null {
  if (!dataValida(data)) return 'data'
  const agora = c.agora ?? agoraBR()
  const d = Date.parse(data + 'T00:00:00Z')
  const hoje = agora.slice(0, 10)
  const dias = (d - Date.parse(hoje + 'T00:00:00Z')) / 864e5
  if (dias < 0 || dias > (staff ? 60 : 14)) return 'janela'
  const h = c.horario
  const ini = tm(hora), fim = ini + dur
  if (staff && data === hoje) {
    if (fim <= tm(agora.slice(11))) return 'passado'
  } else if (`${data} ${hora}` <= agora) return 'passado'
  if (!h.dias.includes(new Date(d).getUTCDay())) return 'fechado'
  if (!staff && ini % BARBEARIA.passoMinutos !== 0) return 'grade'
  if (ini < tm(h.abre) || fim > tm(h.fecha)) return 'expediente'
  if (h.almocoIni && h.almocoFim && ini < tm(h.almocoFim) && fim > tm(h.almocoIni)) return 'almoco'
  if (c.bloqueios.some((k) => ini < tm(k.fim) && fim > tm(k.ini))) return 'bloqueado'
  return c.ocupados.some((a) => ini < tm(a.hora) + a.dur && fim > tm(a.hora)) ? 'ocupado' : null
}

export function horariosLivresDe(c: Contexto, data: string, dur: number, staff = false) {
  const out: string[] = []
  for (let m = tm(c.horario.abre); m + dur <= tm(c.horario.fecha); m += BARBEARIA.passoMinutos) {
    if (!regraHorario(c, data, hhmm(m), dur, staff)) out.push(hhmm(m))
  }
  return out
}
