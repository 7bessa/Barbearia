// O cadastro de novas empresas só deve ser aberto em produção depois de configurar
// confirmação de e-mail e proteção antiabuso. Em desenvolvimento ele segue aberto.
export function onboardingPublicoAtivo(ambiente = process.env.NODE_ENV, liberado = process.env.ONBOARDING_PUBLICO) {
  return ambiente !== 'production' || liberado === '1'
}
