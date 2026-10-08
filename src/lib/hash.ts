import bcrypt from 'bcryptjs'
import { createHash, timingSafeEqual } from 'crypto'

const ROUNDS = 12
// Hash falso: garante o mesmo tempo de resposta quando o e-mail não existe (anti-enumeração/timing).
const DUMMY = bcrypt.hashSync('senha-falsa-para-igualar-tempo', ROUNDS)

export const hashSenha = (senha: string) => bcrypt.hash(senha, ROUNDS)
export const hashSenhaSync = (senha: string) => bcrypt.hashSync(senha, ROUNDS)

export async function verificarSenha(senha: string, hash?: string | null) {
  const ok = await bcrypt.compare(senha, hash ?? DUMMY)
  return ok && !!hash
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// Comparação em tempo constante (hash dos dois lados evita erro de tamanho diferente).
export function compararSeguro(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}
