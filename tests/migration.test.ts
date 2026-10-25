import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

test("migration creates private schema and RLS separates two users", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage, public to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant execute on function storage.foldername(text) to authenticated;
      grant select, insert, update, delete on storage.objects to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261024192021_initial_meu_closet_ai_v2.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261024200423_enhanced_photo.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261025181705_mannequin_profile.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const bucket = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='clothing-photos-private'",
    );
    assert.deepEqual(bucket.rows, [{ public: false }]);
    await db.exec(
      `insert into auth.users(id,raw_user_meta_data) values ('${A}','{"display_name":"Pessoa A"}'),('${B}','{}');`,
    );
    await db.exec(
      `insert into auth.users(id,raw_user_meta_data) values ('${C}','{"display_name":"${"A".repeat(81)}"}');`,
    );
    const longName = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id='${C}'`,
    );
    assert.equal(longName.rows[0].display_name.length, 80);
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${A}';`,
    );
    const profiles = await db.query("select id from public.profiles");
    assert.deepEqual(profiles.rows, [{ id: A }]);
    await db.exec(
      `update public.profiles set mannequin_photo_path='${A}/mannequin/photo.jpg', mannequin_source='photo' where id='${A}';`,
    );
    await assert.rejects(() =>
      db.exec(
        `update public.profiles set mannequin_photo_path='${B}/mannequin/photo.jpg' where id='${A}';`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `update public.profiles set mannequin_source=null where id='${A}';`,
      ),
    );
    await db.exec(
      `reset role; update public.profiles set mannequin_photo_path='${B}/mannequin/photo.jpg', mannequin_source='photo' where id='${B}'; set role authenticated; set request.jwt.claim.sub = '${A}';`,
    );
    const privateMannequin = await db.query(
      "select mannequin_photo_path from public.profiles",
    );
    assert.deepEqual(privateMannequin.rows, [
      { mannequin_photo_path: `${A}/mannequin/photo.jpg` },
    ]);
    await db.exec(
      `insert into public.clothing_items(user_id,name,category,color,occasions) values ('${A}','Camisa','Blusas','Branco',array['Casual']);`,
    );
    await assert.rejects(() =>
      db.exec(
        `update public.clothing_items set enhanced_photo_path='${A}/piece/edited.jpg' where user_id='${A}';`,
      ),
    );
    await db.exec(
      `update public.clothing_items set photo_path='${A}/piece/original.jpg', enhanced_photo_path='${A}/piece/edited.jpg' where user_id='${A}';`,
    );
    await assert.rejects(() =>
      db.exec(
        `update public.clothing_items set enhanced_photo_path='${B}/piece/edited.jpg' where user_id='${A}';`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.clothing_items(user_id,name,category,color,occasions) values ('${B}','Intrusa','Blusas','Branco',array['Casual']);`,
      ),
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name) values ('clothing-photos-private','${A}/piece/photo.jpg');`,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into storage.objects(bucket_id,name) values ('clothing-photos-private','${B}/piece/photo.jpg');`,
      ),
    );
    await db.exec(
      `reset role; insert into storage.objects(bucket_id,name) values ('clothing-photos-private','${B}/piece/photo.jpg');`,
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${A}';`,
    );
    const objects = await db.query<{ name: string }>(
      "select name from storage.objects",
    );
    assert.deepEqual(objects.rows, [{ name: `${A}/piece/photo.jpg` }]);
    await assert.rejects(() =>
      db.exec(
        `update storage.objects set name='${B}/piece/moved.jpg' where name='${A}/piece/photo.jpg';`,
      ),
    );
    const ownPiece = await db.query<{ id: string }>(
      `select id from public.clothing_items where user_id='${A}'`,
    );
    await db.exec(
      `insert into public.outfits(user_id,occasion) values ('${A}','Casual');`,
    );
    const ownOutfit = await db.query<{ id: string }>(
      `select id from public.outfits where user_id='${A}'`,
    );
    await db.exec(
      `reset role; insert into public.clothing_items(user_id,name,category,color,occasions) values ('${B}','Outra','Blusas','Preto',array['Casual']);`,
    );
    const otherPiece = await db.query<{ id: string }>(
      `select id from public.clothing_items where user_id='${B}'`,
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${A}';`,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.outfit_items(user_id,outfit_id,clothing_item_id,position) values ('${A}','${ownOutfit.rows[0].id}','${otherPiece.rows[0].id}',0);`,
      ),
    );
    await db.exec(
      `insert into public.outfit_items(user_id,outfit_id,clothing_item_id,position) values ('${A}','${ownOutfit.rows[0].id}','${ownPiece.rows[0].id}',0);`,
    );
    await db.exec(
      `delete from public.clothing_items where id='${ownPiece.rows[0].id}';`,
    );
    assert.deepEqual(
      (await db.query("select id from public.outfits")).rows,
      [],
    );
    await db.exec(`reset role;`);
  } finally {
    await db.close();
  }
});

test("migration stops on existing table names without changing their data", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema storage; create table storage.buckets(id text primary key); create table public.clothing_items(id integer primary key, marker text); insert into public.clothing_items values (1,'existing');",
    );
    const sql = await readFile(
      new URL(
        "../supabase/migrations/20261024192021_initial_meu_closet_ai_v2.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await assert.rejects(
      () => db.exec(sql),
      /existing table or bucket name detected/,
    );
    assert.deepEqual(
      (await db.query("select id,marker from public.clothing_items")).rows,
      [{ id: 1, marker: "existing" }],
    );
  } finally {
    await db.close();
  }
});
