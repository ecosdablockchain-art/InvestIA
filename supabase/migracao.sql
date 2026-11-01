-- Finanças 360 — estrutura do banco no Supabase
-- Rode este arquivo inteiro no Supabase: SQL Editor › New query › colar › Run.
-- Pode rodar de novo sem problema (é idempotente).

-- Um registro de qualquer tabela do app, guardado como JSON, sempre ligado ao dono.
create table if not exists public.registros (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tabela        text        not null check (char_length(tabela) between 1 and 40),
  id            text        not null check (char_length(id) between 1 and 80),
  dados         jsonb,
  apagado       boolean     not null default false,
  atualizado_em timestamptz not null,                               -- quando o aparelho alterou (vence o mais recente)
  servidor_em   timestamptz not null default clock_timestamp(),     -- quando chegou aqui (para buscar novidades)
  primary key (user_id, tabela, id),
  constraint dados_pequenos check (dados is null or pg_column_size(dados) < 64000)
);

create index if not exists registros_novidades on public.registros (user_id, servidor_em);

-- Segurança: cada pessoa só enxerga e altera as próprias linhas.
alter table public.registros enable row level security;
alter table public.registros force row level security;

drop policy if exists "dono lê" on public.registros;
drop policy if exists "dono cria" on public.registros;
drop policy if exists "dono altera" on public.registros;
create policy "dono lê"     on public.registros for select to authenticated using (user_id = auth.uid());
create policy "dono cria"   on public.registros for insert to authenticated with check (user_id = auth.uid());
create policy "dono altera" on public.registros for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Sem política de DELETE: o app marca como apagado; a linha some de verdade ao excluir a conta.

revoke all on public.registros from anon;
grant select, insert, update on public.registros to authenticated;

-- Envia um lote de alterações. Só grava se a versão recebida for igual ou mais nova que a da nuvem.
create or replace function public.sincronizar_enviar(linhas jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if jsonb_typeof(linhas) <> 'array' or jsonb_array_length(linhas) > 1000 then
    raise exception 'lote inválido';
  end if;
  insert into public.registros (user_id, tabela, id, dados, apagado, atualizado_em, servidor_em)
  select auth.uid(), l->>'tabela', l->>'id',
         case when coalesce((l->>'apagado')::boolean, false) then null else l->'dados' end,
         coalesce((l->>'apagado')::boolean, false),
         (l->>'atualizado_em')::timestamptz,
         clock_timestamp()
  from jsonb_array_elements(linhas) as l
  on conflict (user_id, tabela, id) do update
    set dados = excluded.dados,
        apagado = excluded.apagado,
        atualizado_em = excluded.atualizado_em,
        servidor_em = clock_timestamp()
    where registros.atualizado_em <= excluded.atualizado_em;
end;
$$;

-- Busca o que mudou desde o cursor (microssegundos desde 1970, como texto de 17 dígitos).
-- Devolve as datas em formatos exatos, para o app comparar sem erro de arredondamento.
create or replace function public.sincronizar_receber(p_desde text, p_limite integer)
returns table (tabela text, id text, dados jsonb, apagado boolean, atualizado_em text, servidor_em text)
language sql
stable
security invoker
set search_path = public
as $$
  select r.tabela, r.id, r.dados, r.apagado,
         to_char(r.atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         lpad(((extract(epoch from r.servidor_em) * 1000000)::bigint)::text, 17, '0')
    from public.registros r
   where r.user_id = auth.uid()
     and (p_desde is null or r.servidor_em > timestamptz 'epoch' + (p_desde::bigint * interval '1 microsecond'))
   order by r.servidor_em
   limit least(greatest(p_limite, 1), 1000);
$$;

-- "Apagar tudo": marca como apagados os registros da tabela alterados antes de p_ate.
create or replace function public.sincronizar_apagar_tabela(p_tabela text, p_ate timestamptz)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.registros
     set apagado = true, dados = null, atualizado_em = p_ate, servidor_em = clock_timestamp()
   where user_id = auth.uid() and tabela = p_tabela and not apagado and atualizado_em < p_ate;
$$;

-- Exclui a conta de quem está logado e, em cascata, todos os seus dados (LGPD).
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.sincronizar_enviar(jsonb) from public, anon;
revoke all on function public.sincronizar_apagar_tabela(text, timestamptz) from public, anon;
revoke all on function public.sincronizar_receber(text, integer) from public, anon;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.sincronizar_enviar(jsonb) to authenticated;
grant execute on function public.sincronizar_apagar_tabela(text, timestamptz) to authenticated;
grant execute on function public.sincronizar_receber(text, integer) to authenticated;
grant execute on function public.excluir_minha_conta() to authenticated;
