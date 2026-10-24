-- Optional, approved catalog image. The original photo_path remains untouched.
alter table public.clothing_items
  add column enhanced_photo_path text
  check (
    enhanced_photo_path is null or (
      photo_path is not null
      and left(enhanced_photo_path, char_length(user_id::text) + 1) = user_id::text || '/'
      and char_length(enhanced_photo_path) <= 500
    )
  );
