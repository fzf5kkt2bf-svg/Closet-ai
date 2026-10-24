-- Meu Closet AI V2. Apply once in Supabase SQL Editor, before deploying the app.
-- No existing user data is deleted or migrated from browser storage.
do $$ begin
  if to_regclass('public.profiles') is not null
    or to_regclass('public.clothing_items') is not null
    or to_regclass('public.outfits') is not null
    or to_regclass('public.outfit_items') is not null
    or exists (select 1 from storage.buckets where id = 'clothing-photos-private') then
    raise exception 'Meu Closet AI V2: existing table or bucket name detected; review the project before applying this migration';
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  category text not null check (category in ('Blusas','Calças','Saias','Vestidos','Casacos','Calçados','Acessórios')),
  color text not null check (color in ('Branco','Preto','Bege','Azul','Verde','Rosa','Marrom')),
  style text not null default '' check (char_length(style) <= 80),
  occasions text[] not null check (coalesce(array_length(occasions, 1), 0) between 1 and 4 and occasions <@ array['Casual','Trabalho','Encontro','Festa']::text[]),
  photo_path text check (photo_path is null or (left(photo_path, char_length(user_id::text) + 1) = user_id::text || '/' and char_length(photo_path) <= 500)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists clothing_items_user_created_idx on public.clothing_items(user_id, created_at desc);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occasion text not null check (occasion in ('Casual','Trabalho','Encontro','Festa')),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists outfits_user_created_idx on public.outfits(user_id, created_at desc);

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid not null,
  clothing_item_id uuid not null,
  position smallint not null check (position between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outfit_id, clothing_item_id),
  unique (outfit_id, position),
  foreign key (outfit_id, user_id) references public.outfits(id, user_id) on delete cascade,
  foreign key (clothing_item_id, user_id) references public.clothing_items(id, user_id) on delete cascade
);
create index if not exists outfit_items_user_outfit_idx on public.outfit_items(user_id, outfit_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clothing_items_updated_at before update on public.clothing_items for each row execute function public.set_updated_at();
create trigger outfits_updated_at before update on public.outfits for each row execute function public.set_updated_at();
create trigger outfit_items_updated_at before update on public.outfit_items for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  return new;
end; $$;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_new_user();
-- Include users who already existed before this migration, without replacing profiles.
insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80) from auth.users
on conflict (id) do nothing;

-- A look cannot silently become incomplete when an item is removed.
create or replace function public.delete_outfits_for_removed_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.outfits where user_id = old.user_id and id in
    (select outfit_id from public.outfit_items where clothing_item_id = old.id and user_id = old.user_id);
  return old;
end; $$;
create trigger clothing_item_before_delete before delete on public.clothing_items
for each row execute function public.delete_outfits_for_removed_item();

alter table public.profiles enable row level security;
alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

revoke all on public.profiles, public.clothing_items, public.outfits, public.outfit_items from anon;
grant select, insert, update, delete on public.profiles, public.clothing_items, public.outfits, public.outfit_items to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "clothing_select_own" on public.clothing_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "clothing_insert_own" on public.clothing_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clothing_update_own" on public.clothing_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clothing_delete_own" on public.clothing_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "outfits_select_own" on public.outfits for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfits_insert_own" on public.outfits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfits_update_own" on public.outfits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "outfits_delete_own" on public.outfits for delete to authenticated using ((select auth.uid()) = user_id);

create policy "outfit_items_select_own" on public.outfit_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfit_items_insert_own" on public.outfit_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfit_items_update_own" on public.outfit_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "outfit_items_delete_own" on public.outfit_items for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clothing-photos-private', 'clothing-photos-private', false, 6291456, array['image/jpeg'])
on conflict (id) do nothing;
-- Fail safely if a bucket with this name already exists as public.
do $$ begin
  if exists (select 1 from storage.buckets where id = 'clothing-photos-private' and public) then
    raise exception 'clothing-photos-private must be a private bucket';
  end if;
end $$;

-- Supabase manages RLS on storage.objects; the project owner cannot alter this table.

create policy "clothing_photos_select_own" on storage.objects for select to authenticated
using (bucket_id = 'clothing-photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clothing_photos_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'clothing-photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clothing_photos_update_own" on storage.objects for update to authenticated
using (bucket_id = 'clothing-photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'clothing-photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "clothing_photos_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'clothing-photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
