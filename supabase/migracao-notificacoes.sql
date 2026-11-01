-- Finanças 360 — Notificações (rode depois de migracao.sql)
-- SQL Editor › New query › colar › Run. Pode rodar de novo sem problema.

-- Aparelhos que aceitaram receber notificações.
create table if not exists public.push_inscricoes (
  endpoint  text primary key check (endpoint like 'https://%'),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh    text not null,
  auth      text not null,
  aparelho  text not null default '',
  criada_em timestamptz not null default now()
);
create index if not exists push_inscricoes_usuario on public.push_inscricoes (user_id);

-- Agenda: o app calcula, o servidor envia na hora certa.
create table if not exists public.notificacoes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) <= 120),
  quando     timestamptz not null,
  titulo     text not null check (char_length(titulo) <= 120),
  corpo      text not null check (char_length(corpo) <= 300),
  url        text not null default '#/' check (char_length(url) <= 100),
  enviada_em timestamptz,
  primary key (user_id, id)
);
create index if not exists notificacoes_pendentes on public.notificacoes (quando) where enviada_em is null;

-- Chaves de envio (criadas pelo próprio serviço) e segredo do agendador. Ninguém lê pelo app.
create table if not exists public.config_push (
  id           integer primary key default 1 check (id = 1),
  publica      text,
  privada      text,
  segredo_cron text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
insert into public.config_push (id) values (1) on conflict (id) do nothing;

alter table public.push_inscricoes enable row level security;
alter table public.notificacoes enable row level security;
alter table public.config_push enable row level security;
alter table public.push_inscricoes force row level security;
alter table public.notificacoes force row level security;
alter table public.config_push force row level security;

drop policy if exists "dono vê inscrições" on public.push_inscricoes;
drop policy if exists "dono cria inscrição" on public.push_inscricoes;
drop policy if exists "dono altera inscrição" on public.push_inscricoes;
drop policy if exists "dono apaga inscrição" on public.push_inscricoes;
drop policy if exists "dono vê notificações" on public.notificacoes;
create policy "dono vê inscrições"    on public.push_inscricoes for select to authenticated using (user_id = auth.uid());
create policy "dono cria inscrição"   on public.push_inscricoes for insert to authenticated with check (user_id = auth.uid());
create policy "dono altera inscrição" on public.push_inscricoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono apaga inscrição"  on public.push_inscricoes for delete to authenticated using (user_id = auth.uid());
create policy "dono vê notificações"  on public.notificacoes for select to authenticated using (user_id = auth.uid());
-- config_push: sem políticas = ninguém pelo app (só o serviço, com a chave de serviço)

revoke all on public.push_inscricoes, public.notificacoes, public.config_push from anon;
revoke all on public.config_push from authenticated;
grant select, insert, update, delete on public.push_inscricoes to authenticated;
grant select on public.notificacoes to authenticated;

-- Troca a agenda futura (ainda não enviada) pela nova. O que já foi enviado não volta.
create or replace function public.notificacoes_definir(itens jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if jsonb_typeof(itens) <> 'array' or jsonb_array_length(itens) > 200 then raise exception 'lista inválida'; end if;
  delete from public.notificacoes where user_id = auth.uid() and enviada_em is null;
  insert into public.notificacoes (user_id, id, quando, titulo, corpo, url)
  select auth.uid(), i->>'id', (i->>'quando')::timestamptz, left(i->>'titulo', 120), left(i->>'corpo', 300), left(coalesce(i->>'url', '#/'), 100)
    from jsonb_array_elements(itens) as i
  on conflict (user_id, id) do nothing;
  -- limpeza: enviadas há mais de 60 dias
  delete from public.notificacoes where user_id = auth.uid() and enviada_em < now() - interval '60 days';
end $$;

-- Chave pública de envio (o app precisa dela para inscrever o aparelho).
create or replace function public.push_chave_publica()
returns text language sql stable security definer set search_path = public as $$
  select publica from public.config_push where id = 1;
$$;

revoke all on function public.notificacoes_definir(jsonb), public.push_chave_publica() from public, anon;
grant execute on function public.notificacoes_definir(jsonb), public.push_chave_publica() to authenticated;

-- Agendador: chama o serviço "notificar" a cada 15 minutos.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule('financas360-notificar') where exists (select 1 from cron.job where jobname = 'financas360-notificar');
select cron.schedule('financas360-notificar', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://ppuxdtzpjuxprriyeaar.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select segredo_cron from public.config_push where id = 1)),
    body := '{"acao":"enviar"}'::jsonb
  );
$cron$);
