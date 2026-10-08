import Link from 'next/link'
import { BARBEARIA as B } from '@/config/barbearia'
import { Pagina, Secao } from '@/components/Legal'

export const metadata = { title: `Termos de Uso – ${B.nome}` }

export default function Termos() {
  return (
    <Pagina titulo="Termos de Uso">
      <p>
        Ao criar uma conta ou usar o sistema de agendamento da <b>{B.nome}</b> ({B.razaoSocial}, CNPJ {B.cnpj}), você
        concorda com estes termos. Vigentes desde {B.vigenteDesde}.
      </p>
      <Secao titulo="1. O serviço">
        <p>O sistema permite agendar serviços de barbearia, acompanhar seus agendamentos e receber contato da equipe. Os serviços, preços, durações e horários de funcionamento são definidos pela barbearia e podem mudar.</p>
      </Secao>
      <Secao titulo="2. Conta e responsabilidade">
        <p>Você deve informar dados verdadeiros (nome completo e telefone válido) e manter sua senha em sigilo. Tudo o que for feito na sua conta é de sua responsabilidade. Avise-nos em caso de uso indevido.</p>
      </Secao>
      <Secao titulo="3. Agendamentos, cancelamento e faltas">
        <p>{B.politicaCancelamento} Em caso de falta sem aviso, o barbeiro poderá entrar em contato pelo telefone cadastrado, e faltas repetidas podem limitar novos agendamentos.</p>
      </Secao>
      <Secao titulo="4. Pagamento">
        <p>O pagamento é feito na barbearia, após o atendimento, nas formas aceitas no local (dinheiro, Pix, cartão de débito ou crédito).</p>
      </Secao>
      <Secao titulo="5. Uso adequado">
        <p>É proibido tentar acessar contas de outras pessoas, burlar a segurança, sobrecarregar o sistema ou usá-lo para fins ilícitos. Condutas assim podem levar ao bloqueio da conta.</p>
      </Secao>
      <Secao titulo="6. Dados pessoais">
        <p>O tratamento dos seus dados segue a nossa <Link href="/privacidade" className="text-amber-400 underline">Política de Privacidade</Link>.</p>
      </Secao>
      <Secao titulo="7. Disponibilidade e responsabilidade">
        <p>Buscamos manter o sistema disponível, mas ele pode sofrer interrupções para manutenção ou por fatores externos. Não nos responsabilizamos por indisponibilidades fora do nosso controle.</p>
      </Secao>
      <Secao titulo="8. Alterações e foro">
        <p>Podemos atualizar estes termos; a versão vigente fica sempre nesta página. Fica eleito o foro da comarca de {B.cidade} para resolver eventuais conflitos.</p>
      </Secao>
      <Secao titulo="Contato">
        <p>{B.emailContato} · {B.telefone} · {B.endereco}</p>
      </Secao>
    </Pagina>
  )
}
