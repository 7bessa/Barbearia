import { BARBEARIA as B } from '@/config/barbearia'
import { Pagina, Secao } from '@/components/Legal'

export const metadata = { title: `Política de Privacidade – ${B.nome}` }

export default function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade">
      <p>
        Esta política explica como a <b>{B.nome}</b> ({B.razaoSocial}, CNPJ {B.cnpj}), controladora dos dados, trata suas
        informações pessoais, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Vigente desde {B.vigenteDesde}.
      </p>
      <Secao titulo="Dados que coletamos">
        <p>Nome completo, telefone, e-mail, histórico de agendamentos e atendimentos (serviço, barbeiro, valor e forma de pagamento) e observações de atendimento feitas pela equipe (ex.: preferências de corte). Coletamos apenas o necessário para prestar o serviço.</p>
      </Secao>
      <Secao titulo="Para que usamos e base legal">
        <p>Executar o contrato de prestação de serviço (agendar e atender), entrar em contato por telefone em caso de ausência ou imprevisto, controle financeiro e cumprimento de obrigações legais. Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</p>
      </Secao>
      <Secao titulo="Quem acessa">
        <p>O barbeiro vê nome, telefone e histórico apenas dos clientes que atende. O dono e a administração têm acesso a todos os agendamentos e ao financeiro. Outros clientes nunca veem seus dados. As observações de atendimento são internas e não aparecem para você.</p>
      </Secao>
      <Secao titulo="Segurança">
        <p>Senhas não são armazenadas em texto simples: usamos hash bcrypt. O acesso usa cookies com proteções de segurança, e ações críticas ficam registradas em log de auditoria.</p>
      </Secao>
      <Secao titulo="Por quanto tempo guardamos">
        <p>Enquanto sua conta existir. Ao excluir a conta, seus dados pessoais e observações são apagados. Registros financeiros de atendimentos já realizados são mantidos de forma anonimizada (sem nome e telefone) pelo prazo exigido pela legislação fiscal e contábil.</p>
      </Secao>
      <Secao titulo="Seus direitos">
        <p>Você pode confirmar a existência de tratamento, acessar, corrigir, anonimizar ou excluir seus dados e revogar o consentimento a qualquer momento. Para excluir a conta, use “Excluir minha conta” na área do cliente ou fale com nosso encarregado.</p>
      </Secao>
      <Secao titulo="Contato do encarregado (DPO)">
        <p>{B.emailPrivacidade} · {B.endereco}, {B.cidade}</p>
      </Secao>
    </Pagina>
  )
}
