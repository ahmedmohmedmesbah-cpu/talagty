begin;

create table if not exists public.storefront_appearance (
  id smallint primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 32768),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  updated_by bigint references public.users(id) on delete set null
);
create index if not exists storefront_appearance_updated_by_idx on public.storefront_appearance(updated_by);
alter table public.storefront_appearance enable row level security;
revoke all on public.storefront_appearance from anon, authenticated;
grant select, insert, update on public.storefront_appearance to service_role;
insert into public.storefront_appearance(id) values (1) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storefront-images', 'storefront-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Uploads go through the admin-only API using service_role; no public write policy.

commit;
