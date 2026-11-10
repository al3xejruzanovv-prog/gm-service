-- ============================================================
--  GM Service — таблица для правок страниц (Supabase)
--  Выполните этот скрипт в Supabase → SQL Editor → New query.
-- ============================================================

create table if not exists public.page_content (
  page        text        not null,          -- например index.html
  key         text        not null,          -- например h1#7
  html        text        not null,          -- новый HTML блока
  updated_at  timestamptz not null default now(),
  updated_by  uuid        default auth.uid(), -- кто сохранил
  primary key (page, key)
);

comment on table public.page_content is
  'Правки контента сайта, сделанные администратором через /admin.html';

-- Доступ только на чтение для всех, запись — только для вошедших админов.
alter table public.page_content enable row level security;

drop policy if exists "page_content_public_read"  on public.page_content;
drop policy if exists "page_content_admin_insert" on public.page_content;
drop policy if exists "page_content_admin_update" on public.page_content;
drop policy if exists "page_content_admin_delete" on public.page_content;

create policy "page_content_public_read"
  on public.page_content
  for select
  using (true);

create policy "page_content_admin_insert"
  on public.page_content
  for insert
  to authenticated
  with check (true);

create policy "page_content_admin_update"
  on public.page_content
  for update
  to authenticated
  using (true)
  with check (true);

create policy "page_content_admin_delete"
  on public.page_content
  for delete
  to authenticated
  using (true);

grant select on public.page_content to anon;
grant select, insert, update, delete on public.page_content to authenticated;

-- Обновляем кэш схемы PostgREST, чтобы таблица сразу стала доступна API.
notify pgrst, 'reload schema';
