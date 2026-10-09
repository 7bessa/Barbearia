// ÚNICO arquivo que você edita para cada cliente (barbearia). Nada disso deve ficar escrito direto nas telas.
export const BARBEARIA = {
  nome: 'Barbearia Navalha de Ouro',
  slogan: 'Onde a tradição encontra o estilo moderno',
  logo: '/logo.svg',
  cores: { primaria: '#D4AF37', fundo: '#0A0A0A' },

  // Dados legais (usados em /termos e /privacidade)
  razaoSocial: 'Barbearia Exemplo LTDA',
  cnpj: '00.000.000/0001-00',
  endereco: 'Rua Exemplo, 123 – Centro',
  cidade: 'Goiânia/GO',
  emailContato: 'contato@exemplo.com.br',
  emailPrivacidade: 'privacidade@exemplo.com.br', // canal do encarregado (LGPD)
  telefone: '(62) 99999-0000',
  whatsapp: '5562999990000',
  instagram: '',
  vigenteDesde: '04/10/2026',
  cancelamentoHoras: 2, // antecedência mínima para o CLIENTE cancelar (equipe não tem esse limite)
  politicaCancelamento: 'O cancelamento deve ser feito com pelo menos 2 horas de antecedência.', // mantenha coerente com cancelamentoHoras
  passoMinutos: 15, // grade de horários oferecida ao cliente (equipe pode encaixar de 5 em 5 min)
  conviteHoras: 72, // validade do código de convite de barbeiro

  // Valores iniciais (o dono altera depois pelo painel)
  horario: { abre: '09:00', fecha: '19:00', almocoIni: '12:00' as string | null, almocoFim: '13:00' as string | null, dias: [1, 2, 3, 4, 5, 6] }, // 0=domingo
  comissaoPadrao: 40, // % do barbeiro sobre cada serviço
  formasPagamento: ['dinheiro', 'pix', 'debito', 'credito'] as const,
}
