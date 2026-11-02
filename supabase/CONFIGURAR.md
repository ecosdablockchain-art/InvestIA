# Configurar o Supabase (contas e nuvem do Finanças 360)

Leva uns 15 minutos, tudo pelo navegador.

## 1. Criar o projeto

1. Entre em https://supabase.com e crie uma conta (pode usar o GitHub).
2. **New project**:
   - Nome: `financas-360`
   - Senha do banco: gere uma forte e guarde num gerenciador de senhas (o app não usa, mas você pode precisar).
   - **Region: South America (São Paulo)**: dados mais perto e no Brasil.
   - Plano: Free.

## 2. Criar as tabelas e as regras de segurança

1. No menu da esquerda: **SQL Editor › New query**.
2. Cole o conteúdo inteiro de `supabase/migracao.sql` e clique em **Run**.
3. Deve aparecer "Success. No rows returned".

## 3. Configurar o login

**Authentication › URL Configuration**
- Site URL: `https://ecosdablockchain-art.github.io/InvestIA/`
- Redirect URLs: adicione `https://ecosdablockchain-art.github.io/InvestIA/**`

**Authentication › Sign In / Providers › Email**
- Email: ligado
- Confirm email: **ligado** (a pessoa confirma o e-mail antes de entrar)
- Minimum password length: 8

**Authentication › Emails (templates)**, opcional: traduzir os textos de "Confirm signup" e "Reset password" para português.

## 4. Pegar os dados públicos do projeto

**Project Settings › API** (ou **Data API / API Keys**):
- **Project URL**, algo como `https://abcdxyz.supabase.co`
- **Publishable key** (ou "anon public"), que começa com `sb_publishable_` ou `eyJ...`

Mande esses dois para o Claude. Eles são públicos por natureza: a segurança vem das regras do banco.
**Nunca** mande nem coloque no código a chave `service_role` / `secret`.

## 5. Antes de abrir para o público

- **E-mails**: configurado com SMTP do Gmail (senha de app), até ~500 por dia. Rate limit em Authentication › Rate Limits: 100/hora.
  Para abrir ao público, configure um SMTP próprio em **Authentication › Emails › SMTP Settings**
  (ex.: Resend, Brevo ou Amazon SES).
- **Termos e Privacidade**: preenchidos (responsável e contato em `src/conta/Legal.tsx`). Recomendado: revisão por um advogado.
- **CNPJ / MEI**: confirmar se a atividade está coberta antes de cobrar assinatura.
