/**
 * Dados públicos do projeto no Supabase (Settings › API). Podem ficar no código:
 * a chave "anon/publishable" foi feita para isso, e as regras do banco protegem os dados.
 * NUNCA coloque aqui a chave "service_role"/secret.
 */
export const PROJETO = {
  url: 'https://ppuxdtzpjuxprriyeaar.supabase.co',
  chavePublica: 'sb_publishable_Sdd0Ge9XaQXr3jSkJ88zRA_9YIWxkSH',
  /** Site key do Cloudflare Turnstile (pública). Vazia = CAPTCHA desligado. A secret key fica só no Supabase. */
  chaveCaptcha: '',
}
