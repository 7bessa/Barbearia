import { NextRequest, NextResponse } from 'next/server'
import { cadastroSchema } from '@/lib/validation'
import { BARBEARIA_PADRAO_ID, barbeariaDoConvite, cadastrar, conflito, ConviteInvalido, conviteValido, papelDoConvite, usuarioPorEmail, usuarioPorTelefone } from '@/lib/db'
import { hashSenha } from '@/lib/hash'
import { consumir } from '@/lib/rateLimit'
import { audit, getIp } from '@/lib/audit'
import { criarSessao, erro, publico, seguro, verificarCsrf } from '@/lib/auth'

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  // 5 cadastros/hora por IP: também freia tentativa de adivinhar o código de convite.
  if (!(await consumir(`cadastro:${getIp(req)}`, 5, 60 * 60 * 1000))) return erro(429, 'Muitas tentativas. Tente novamente mais tarde.')

  const p = cadastroSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos. Revise os campos.')
  const d = p.data

  // Perfis de equipe só entram com convite válido, individual e de uso único.
  let role: 'cliente' | 'barbeiro' | 'recepcionista' = 'cliente'
  let barbeariaId = BARBEARIA_PADRAO_ID
  if (d.role === 'barbeiro' || d.role === 'recepcionista') {
    if (!d.codigoConvite || !(await conviteValido(d.codigoConvite))) {
      await audit(req, { acao: 'cadastro_equipe', resultado: 'negado', detalhe: { motivo: 'convite' } })
      return erro(403, 'Código de convite inválido. Solicite um novo código ao responsável.')
    }
    if (papelDoConvite(d.codigoConvite) !== d.role) return erro(403, 'Esse código foi criado para outro tipo de acesso.')
    barbeariaId = await barbeariaDoConvite(d.codigoConvite) ?? BARBEARIA_PADRAO_ID
    role = d.role
  } else if (d.role && d.role !== 'cliente') {
    await audit(req, { acao: 'cadastro_role_ignorado', resultado: 'negado', detalhe: { pedido: d.role.slice(0, 20) } })
  }

  const GENERICO = 'Não foi possível concluir o cadastro. Verifique os dados.'
  // E-mail ou telefone já cadastrados (inclui cliente de balcão): mesma resposta genérica.
  if ((await usuarioPorEmail(d.email)) || (await usuarioPorTelefone(d.telefone, barbeariaId))) return erro(409, GENERICO)

  const senhaHash = await hashSenha(d.senha)
  let u
  try {
    // Usuário e consumo do convite na MESMA transação: se qualquer parte falhar, nada é gravado.
    u = await cadastrar({ nome: d.nome, email: d.email, telefone: d.telefone, role, senhaHash, barbeariaId }, d.codigoConvite)
  } catch (e) {
    if (e instanceof ConviteInvalido) return erro(403, 'Código de convite inválido. Solicite ao dono da barbearia.')
    if (conflito(e)) return erro(409, GENERICO) // e-mail/telefone duplicados numa corrida
    throw e
  }
  const res = NextResponse.json({ usuario: publico(u) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  await criarSessao(res, u)
  await audit(req, { acao: 'cadastro', resultado: 'ok', userId: u.id, detalhe: { role } })
  return res
})
