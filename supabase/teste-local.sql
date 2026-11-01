-- Teste local do SQL, simulando o Supabase num Postgres comum (não rodar no Supabase).
\set ON_ERROR_STOP on
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

\i /home/user/financas-360/supabase/migracao.sql
\i /home/user/financas-360/supabase/migracao.sql
\echo '✓ migração aplicada duas vezes (idempotente)'

-- Pessoa 1 grava
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.sincronizar_enviar('[{"tabela":"lancamentos","id":"a","dados":{"descricao":"Padaria","valor":4590},"apagado":false,"atualizado_em":"2026-11-05T10:00:00Z"}]');
-- versão mais velha não sobrescreve
select public.sincronizar_enviar('[{"tabela":"lancamentos","id":"a","dados":{"descricao":"VELHA"},"apagado":false,"atualizado_em":"2026-11-05T09:00:00Z"}]');
do $$ begin assert (select dados->>'descricao' from registros where id = 'a') = 'Padaria', 'versão velha sobrescreveu'; end $$;
\echo '✓ versão mais velha não sobrescreve'

-- receber: formatos exatos e cursor em microssegundos, com várias linhas no mesmo milissegundo
select public.sincronizar_enviar((select jsonb_agg(jsonb_build_object('tabela','lote','id','x'||g,'dados','{}'::jsonb,'apagado',false,'atualizado_em','2026-11-05T10:00:00.123Z')) from generate_series(1,600) g));
do $$
declare r record; cursor_ text := null; total int := 0; paginas int := 0;
begin
  loop
    paginas := paginas + 1;
    exit when paginas > 10;
    select count(*), max(servidor_em) into r from public.sincronizar_receber(cursor_, 250) s;
    exit when r.count = 0;
    total := total + r.count;
    cursor_ := r.max;
  end loop;
  assert total = 601, format('paginação perdeu ou repetiu linhas: %s', total);
  assert (select atualizado_em from public.sincronizar_receber(null, 1) limit 1) = '2026-11-05T10:00:00.000Z', 'formato de data inesperado';
  assert (select length(servidor_em) from public.sincronizar_receber(null, 1) limit 1) = 17, 'cursor sem 17 dígitos';
end $$;
\echo '✓ receber pagina sem perder nem repetir (601 linhas em páginas de 250), datas em formato exato'

-- Pessoa 2 não vê nem altera os dados da pessoa 1
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin assert (select count(*) from registros) = 0, 'pessoa 2 viu dados da pessoa 1'; end $$;
update registros set dados = '{"hack":1}' where id = 'a';
select public.sincronizar_enviar('[{"tabela":"lancamentos","id":"a","dados":{"descricao":"da pessoa 2"},"apagado":false,"atualizado_em":"2027-01-01T00:00:00Z"}]');
do $$ begin assert (select count(*) from registros) = 1, 'pessoa 2 deveria ter só o próprio registro'; end $$;
\echo '✓ pessoa 2 não enxerga nem altera a pessoa 1 (o mesmo id vira um registro separado dela)'

-- Tentar gravar em nome de outra pessoa é recusado
do $$ begin
  begin
    insert into registros (user_id, tabela, id, dados, atualizado_em) values ('11111111-1111-1111-1111-111111111111', 'x', 'y', '{}', now());
    raise exception 'conseguiu gravar como outra pessoa';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo '✓ gravar em nome de outra pessoa é recusado'

-- Apagar linhas diretamente não é permitido (só marcar como apagado)
do $$ begin
  begin
    delete from registros;
    raise exception 'conseguiu apagar direto';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo '✓ DELETE direto é recusado'

-- apagar tabela: só antes da data
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.sincronizar_enviar('[{"tabela":"lancamentos","id":"b","dados":{"descricao":"depois"},"apagado":false,"atualizado_em":"2026-11-07T00:00:00Z"}]');
select public.sincronizar_apagar_tabela('lancamentos', '2026-11-06T00:00:00Z');
do $$ begin
  assert (select apagado from registros where id = 'a'), 'a deveria estar apagado';
  assert not (select apagado from registros where id = 'b'), 'b foi gravado depois e deveria continuar';
  assert (select dados from registros where id = 'a') is null, 'dados apagados deveriam sumir';
end $$;
\echo '✓ apagar tabela respeita a data'

-- Visitante sem login não lê nada
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from registros;
    raise exception 'anon leu a tabela';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ begin
  begin
    perform public.sincronizar_enviar('[]');
    raise exception 'anon executou a função';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo '✓ visitante sem login não lê nem grava'

-- Excluir a conta apaga a pessoa e os dados dela, e só dela
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.excluir_minha_conta();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'conta não excluída';
  assert not exists (select 1 from registros where user_id = '11111111-1111-1111-1111-111111111111'), 'dados não excluídos';
  assert exists (select 1 from registros where user_id = '22222222-2222-2222-2222-222222222222'), 'apagou dados de outra pessoa';
end $$;
\echo '✓ excluir conta apaga só a própria conta e os próprios dados'
