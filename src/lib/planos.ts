export type Plano = 'essencial' | 'profissional'

export const LIMITES_PLANO: Record<Plano, { profissionais: number; cadeiras: number }> = {
  essencial: { profissionais: 2, cadeiras: 2 },
  profissional: { profissionais: 999, cadeiras: 999 },
}

export const nomePlano = (plano: string) => plano === 'profissional' ? 'Profissional' : 'Essencial'
export const limiteDoPlano = (plano: string) => LIMITES_PLANO[plano === 'profissional' ? 'profissional' : 'essencial']
