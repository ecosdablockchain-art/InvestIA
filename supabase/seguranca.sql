-- Finanças 360 — Reforço de segurança (rode depois de migracao.sql e migracao-notificacoes.sql)
-- SQL Editor › New query › colar › Run. Pode rodar de novo sem problema.

-- 1) Permissões mínimas. O Supabase libera "tudo" (inclusive TRUNCATE, que ignora as regras de linha)
--    para qualquer tabela nova. Aqui cada papel fica só com o que o app usa.
revoke all on public.registros, public.push_inscricoes, public.notificacoes, public.config_push from anon, authenticated;
grant select, insert, update on public.registros to authenticated;
grant select, insert, update, delete on public.push_inscricoes to authenticated;
grant select on public.notificacoes to authenticated;

-- 2) Cota por pessoa: impede que uma conta encha o banco e derrube o serviço para todos.
create or replace function public.registros_conferir_cota()
returns trigger language plpgsql set search_path = public as $$
declare v_linhas bigint; v_bytes bigint;
begin
  if auth.uid() is null then return null; end if;
  select count(*), coalesce(sum(pg_column_size(dados)), 0) into v_linhas, v_bytes
    from public.registros where user_id = auth.uid();
  if v_linhas > 100000 or v_bytes > 50 * 1024 * 1024 then
    raise exception 'limite de armazenamento da conta atingido' using errcode = '54000';
  end if;
  return null;
end $$;
drop trigger if exists registros_cota on public.registros;
create trigger registros_cota after insert on public.registros
  for each statement execute function public.registros_conferir_cota();

-- 3) Inscrições de notificação: só endereços dos serviços de push oficiais (evita usar o servidor
--    para mandar requisições a sites quaisquer) e no máximo 10 aparelhos por pessoa.
alter table public.push_inscricoes drop constraint if exists push_endpoint_oficial;
alter table public.push_inscricoes add constraint push_endpoint_oficial check (
  char_length(endpoint) <= 1000
  and endpoint ~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
  and char_length(p256dh) <= 200 and char_length(auth) <= 100 and char_length(aparelho) <= 80
) not valid;

create or replace function public.push_conferir_limite()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.push_inscricoes where user_id = new.user_id) >= 10 then
    raise exception 'limite de 10 aparelhos com notificações' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists push_limite on public.push_inscricoes;
create trigger push_limite before insert on public.push_inscricoes
  for each row execute function public.push_conferir_limite();

-- 4) Controle do botão "Enviar notificação de teste" (usado pelo serviço notificar): 1 a cada 30 segundos.
create table if not exists public.push_limites (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  ultimo_teste timestamptz not null
);
alter table public.push_limites enable row level security;
revoke all on public.push_limites from anon, authenticated;

-- 5) Funções: ninguém de fora chama as funções internas de conferência.
revoke all on function public.registros_conferir_cota(), public.push_conferir_limite() from public, anon, authenticated;

-- Conferência: deve mostrar "ok" nas três colunas.
select
  case when has_table_privilege('authenticated', 'public.registros', 'TRUNCATE') then 'FALHOU' else 'ok' end as sem_truncate,
  case when exists (select 1 from pg_trigger where tgname = 'registros_cota') then 'ok' else 'FALHOU' end as cota,
  case when exists (select 1 from pg_constraint where conname = 'push_endpoint_oficial') then 'ok' else 'FALHOU' end as push_oficial;
