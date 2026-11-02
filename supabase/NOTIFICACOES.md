# Ativar as notificações no Supabase

São 3 passos, uns 10 minutos, tudo pelo navegador. Nenhuma chave precisa ser copiada: o serviço cria e guarda as próprias chaves.

## 1. Rodar o SQL

1. No Supabase: **SQL Editor › New query**.
2. Cole o conteúdo inteiro de `supabase/migracao-notificacoes.sql` e clique em **Run**.
3. Deve aparecer "Success".

Se aparecer erro sobre `pg_cron` ou `pg_net`: vá em **Database › Extensions**, ligue **pg_cron** e **pg_net**, e rode o SQL de novo.

## 2. Criar o serviço "notificar"

1. No menu da esquerda: **Edge Functions › Deploy a new function › Via Editor**.
2. Nome da função: **`notificar`** (exatamente assim).
3. Apague o código de exemplo e cole o conteúdo inteiro de `supabase/functions/notificar/index.ts`.
4. Clique em **Deploy function**.
5. Depois do deploy, abra a função › **Details** (ou Settings) e **desligue "Verify JWT" / "Enforce JWT verification"**. O próprio serviço confere quem está chamando.

## 3. Testar

1. No app: **Ajustes › Notificações › Receber neste aparelho**. Aceite a permissão.
   - No iPhone: o app precisa estar instalado na tela de início (iOS 16.4 ou mais novo).
2. Toque em **Enviar notificação de teste**. Deve chegar em alguns segundos.

A partir daí, o Supabase confere a agenda a cada 15 minutos e envia o que estiver na hora:

- fatura vencendo (3 dias antes e no dia, às 9h),
- categoria que passou do limite,
- lembrete semanal (domingo, 19h).

## Se algo não funcionar

- **"O serviço de notificações ainda não foi configurado"**: o passo 2 não foi feito, ou o nome da função não é `notificar`.
- **O teste chega, mas os avisos agendados não**: em **Integrations › Cron** (ou **Database › Cron Jobs**), confira se o job `financas360-notificar` existe e roda a cada 15 minutos.
- **Para atualizar o serviço no futuro**: abra a função `notificar` › aba **Code**, troque o conteúdo do `index.ts` pelo novo e faça o deploy de novo. Confira depois que "Verify JWT" continua desligado.
- **Segurança**: rode também `supabase/seguranca.sql` (uma vez; pode repetir).
