-- Teste local das notificações (Postgres comum simulando o Supabase; sem a parte do pg_cron).
-- Antes: sed "/^-- Agendador/,$d" supabase/migracao-notificacoes.sql > /tmp/f360-pg/notif-sem-cron.sql
\set ON_ERROR_STOP on
\i /tmp/f360-pg/notif-sem-cron.sql
\i /tmp/f360-pg/notif-sem-cron.sql
\echo '✓ migração de notificações aplicada duas vezes'
reset role;
do $$ begin assert (select length(segredo_cron) from config_push) = 64, 'segredo do agendador não foi criado'; end $$;
update config_push set publica = 'CHAVE-PUBLICA', privada = 'CHAVE-PRIVADA';
insert into auth.users values ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002') on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
insert into push_inscricoes (endpoint, p256dh, auth, aparelho) values ('https://push.exemplo/rafael', 'p', 'a', 'iPhone');
select public.notificacoes_definir('[{"id":"fatura:c:202611:3d","quando":"2026-11-07T12:00:00Z","titulo":"Fatura vence em 3 dias","corpo":"R$ 100,00","url":"#/credito"},{"id":"semanal:2026-11-08","quando":"2026-11-08T22:00:00Z","titulo":"Lembrete","corpo":"x"}]');
do $$ begin
  assert (select count(*) from notificacoes) = 2, 'agenda não gravada';
  assert public.push_chave_publica() = 'CHAVE-PUBLICA', 'chave pública não disponível';
end $$;
do $$ begin
  begin perform * from config_push; raise exception 'leu a config'; exception when insufficient_privilege then null; end;
end $$;
\echo '✓ agenda gravada; o app lê só a chave pública, nunca a privada nem o segredo'

-- servidor marca uma como enviada; nova agenda não reenvia e troca as pendentes
reset role;
update notificacoes set enviada_em = now() where id = 'fatura:c:202611:3d';
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select public.notificacoes_definir('[{"id":"fatura:c:202611:3d","quando":"2026-11-07T12:00:00Z","titulo":"de novo","corpo":"x"},{"id":"semanal:2026-11-15","quando":"2026-11-15T22:00:00Z","titulo":"Lembrete","corpo":"x"}]');
do $$ begin
  assert (select titulo from notificacoes where id = 'fatura:c:202611:3d') = 'Fatura vence em 3 dias', 'enviada foi sobrescrita';
  assert (select count(*) from notificacoes where enviada_em is null) = 1, 'pendentes antigas não foram trocadas';
  assert exists (select 1 from notificacoes where id = 'semanal:2026-11-15'), 'nova não entrou';
end $$;
\echo '✓ a agenda nova troca as pendentes e nunca reenvia o que já foi enviado'

-- outra pessoa não vê agenda nem aparelhos
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from notificacoes) = 0, 'viu agenda alheia';
  assert (select count(*) from push_inscricoes) = 0, 'viu aparelho alheio';
  begin insert into push_inscricoes (endpoint, user_id, p256dh, auth) values ('https://x', 'bbbbbbbb-0000-0000-0000-000000000001', 'p', 'a'); raise exception 'inscreveu aparelho em nome de outro'; exception when insufficient_privilege then null; end;
end $$;
delete from push_inscricoes;
reset role;
do $$ begin assert (select count(*) from push_inscricoes) = 1, 'apagou aparelho alheio'; end $$;
\echo '✓ ninguém vê nem mexe na agenda ou nos aparelhos de outra pessoa'

set role anon;
do $$ begin begin perform public.push_chave_publica(); raise exception 'anon leu a chave'; exception when insufficient_privilege then null; end; end $$;
\echo '✓ visitante sem login não acessa nada'
