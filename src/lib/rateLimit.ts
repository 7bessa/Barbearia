// Rate limit no PostgreSQL: vale para várias instâncias e sobrevive a reinício.
import { prisma } from './prisma'

export const JANELA = 15 * 60 * 1000

// Incrementa o contador da chave (zera se a janela passou). Atômico.
async function incrementar(chave: string, janelaMs: number) {
  const seg = janelaMs / 1000
  const r = await prisma.$queryRaw<{ n: number }[]>`
    INSERT INTO "RateLimit" ("chave", "n", "ini", "ate") VALUES (${chave}, 1, now(), to_timestamp(0))
    ON CONFLICT ("chave") DO UPDATE SET
      "n"   = CASE WHEN "RateLimit"."ini" < now() - make_interval(secs => ${seg}::double precision) THEN 1 ELSE "RateLimit"."n" + 1 END,
      "ini" = CASE WHEN "RateLimit"."ini" < now() - make_interval(secs => ${seg}::double precision) THEN now() ELSE "RateLimit"."ini" END
    RETURNING "n"`
  return Number(r[0].n)
}

async function limparAntigos() {
  await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "ini" < now() - interval '1 day' AND "ate" < now()`
}

// Retorna segundos restantes de bloqueio (0 = liberado).
export async function bloqueado(chave: string) {
  const e = await prisma.rateLimit.findUnique({ where: { chave }, select: { ate: true } })
  const falta = e ? e.ate.getTime() - Date.now() : 0
  return falta > 0 ? Math.ceil(falta / 1000) : 0
}

export async function registrarFalha(chave: string, max = 5, janela = JANELA, bloqueio = JANELA) {
  const n = await incrementar(chave, janela)
  if (n >= max) {
    await prisma.$executeRaw`UPDATE "RateLimit" SET "ate" = now() + make_interval(secs => ${bloqueio / 1000}::double precision) WHERE "chave" = ${chave}`
  }
  if (Math.random() < 0.02) await limparAntigos()
}

export const limpar = async (chave: string) => { await prisma.rateLimit.deleteMany({ where: { chave } }) }

// Contador simples: true = dentro do limite.
export async function consumir(chave: string, max: number, janela: number) {
  const n = await incrementar(chave, janela)
  if (Math.random() < 0.02) await limparAntigos()
  return n <= max
}
