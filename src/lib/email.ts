type EmailConta = { to: string; nome: string; assunto: string; acao: string; limite: string; url: string }

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function enviarEmailConta(email: EmailConta) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') throw new Error('Provedor de e-mail não configurado')
    console.info(`[email local] ${email.assunto} para ${email.to}: ${email.url}`)
    return
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.assunto,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#171717"><h1>${escapar(email.assunto)}</h1><p>Olá, ${escapar(email.nome)}.</p><p><a href="${escapar(email.url)}" style="display:inline-block;padding:12px 20px;background:#c28a45;color:#111;text-decoration:none;border-radius:6px">${escapar(email.acao)}</a></p><p>${escapar(email.limite)}</p><p>Se você não solicitou esta ação, ignore esta mensagem.</p></div>`,
    }),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new Error(`Falha no envio de e-mail (${resposta.status})`)
}
