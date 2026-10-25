-- One private mannequin per existing profile. Existing accounts and outfits are unchanged.
alter table public.profiles
  add column mannequin_photo_path text
    check (mannequin_photo_path is null or (
      left(mannequin_photo_path, char_length(id::text) + 1) = id::text || '/'
      and char_length(mannequin_photo_path) <= 500
    )),
  add column mannequin_source text
    check (mannequin_source is null or mannequin_source in ('photo', 'generated')),
  add column mannequin_traits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(mannequin_traits) = 'object' and
      length(mannequin_traits::text) <= 600),
  add constraint mannequin_source_requires_photo
    check ((mannequin_source is null) = (mannequin_photo_path is null));

-- profiles already has owner-only SELECT/UPDATE RLS. The existing private
-- clothing-photos-private bucket restricts every file to the auth.uid() prefix.
