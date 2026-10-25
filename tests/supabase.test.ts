import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoPieces, type Look, type Piece } from "../lib/closet";
import {
  deletePiece,
  legacyId,
  saveLook,
  savePiece,
  saveMannequin,
  deleteMannequin,
  supabaseConfigured,
} from "../lib/supabase";
const owner = "11111111-1111-4111-8111-111111111111";
const piece: Piece = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Camisa",
  category: "Blusas",
  color: "Branco",
  occasions: ["Casual"],
  style: "Clássico",
  photoPath: `${owner}/old.jpg`,
  image: "data:image/jpeg;base64,/9j/2Q==",
};
function fakeClient(
  options: {
    rowError?: boolean;
    itemError?: boolean;
    removeError?: boolean;
  } = {},
) {
  const events: string[] = [];
  const success = { data: { id: piece.id }, error: null };
  const failure = { data: null, error: new Error("Falha simulada") };
  const query = (result: typeof success | typeof failure) => {
    const chain = {
      eq: () => chain,
      select: () => chain,
      single: async () => result,
      then: (resolve: (value: typeof result) => void) =>
        Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const api = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          events.push(`upload:${path}`);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          events.push(`remove:${paths[0]}`);
          return {
            error: options.removeError
              ? new Error("Storage indisponível")
              : null,
          };
        },
      }),
    },
    from: (table: string) => ({
      insert: () => {
        events.push(`insert:${table}`);
        return query(
          table === "outfit_items" && options.itemError ? failure : success,
        );
      },
      update: () => {
        events.push(`update:${table}`);
        return query(options.rowError ? failure : success);
      },
      delete: () => {
        events.push(`delete:${table}`);
        return query(
          options.rowError && table === "clothing_items" ? failure : success,
        );
      },
    }),
  } as unknown as SupabaseClient;
  return { api, events };
}
test("demo data is separate and configuration is explicit", () => {
  assert.equal(demoPieces.length, 12);
  assert(demoPieces.every((p) => p.demo));
  assert.equal(typeof supabaseConfigured, "boolean");
});
test("new photo is uploaded before row update, old photo removed afterward", async () => {
  const { api, events } = fakeClient();
  const result = await savePiece(piece, owner, piece, api);
  assert.equal(result.cleanupWarning, false);
  assert.match(events[0], /^upload:/);
  assert.equal(events[1], "update:clothing_items");
  assert.equal(events[2], `remove:${owner}/old.jpg`);
});
test("failed row update removes only the new upload", async () => {
  const { api, events } = fakeClient({ rowError: true });
  await assert.rejects(
    () => savePiece(piece, owner, piece, api),
    /Falha simulada/,
  );
  assert.match(events[0], /^upload:/);
  assert.equal(events[1], "update:clothing_items");
  assert.match(events[2], /^remove:/);
  assert.notEqual(events[2], `remove:${owner}/old.jpg`);
});
test("approved catalog image uploads separately and preserves the original", async () => {
  const { api, events } = fakeClient();
  const approved: Piece = {
    ...piece,
    image: "https://private.example/photo.jpg",
    enhancedImage: "data:image/jpeg;base64,/9j/2Q==",
  };
  const result = await savePiece(approved, owner, piece, api);
  assert.equal(result.cleanupWarning, false);
  assert.match(events[0], /^upload:/);
  assert.equal(events[1], "update:clothing_items");
  assert.equal(events.length, 2);
});
test("failed approval removes only the generated upload", async () => {
  const { api, events } = fakeClient({ rowError: true });
  const approved: Piece = {
    ...piece,
    image: "https://private.example/photo.jpg",
    enhancedImage: "data:image/jpeg;base64,/9j/2Q==",
  };
  await assert.rejects(() => savePiece(approved, owner, piece, api));
  assert.match(events[0], /^upload:/);
  assert.equal(events[1], "update:clothing_items");
  assert.match(events[2], /^remove:/);
  assert.notEqual(events[2], `remove:${owner}/old.jpg`);
});
test("replacing a mannequin photo updates the profile before removing the old private file", async () => {
  const { api, events } = fakeClient();
  const previous = {
    source: "photo" as const,
    photoPath: `${owner}/mannequin/old.jpg`,
    image: "signed",
    traits: {},
  };
  const result = await saveMannequin(
    owner,
    "data:image/jpeg;base64,/9j/2Q==",
    "generated",
    { hair: "curto" },
    previous,
    api,
  );
  assert.equal(result.cleanupWarning, false);
  assert.match(events[0], new RegExp(`^upload:${owner}/mannequin/`));
  assert.equal(events[1], "update:profiles");
  assert.equal(events[2], `remove:${previous.photoPath}`);
});
test("failed mannequin update removes only the new file", async () => {
  const { api, events } = fakeClient({ rowError: true });
  const previous = {
    source: "photo" as const,
    photoPath: `${owner}/mannequin/old.jpg`,
    image: "signed",
    traits: {},
  };
  await assert.rejects(() =>
    saveMannequin(
      owner,
      "data:image/jpeg;base64,/9j/2Q==",
      "photo",
      {},
      previous,
      api,
    ),
  );
  assert.equal(events[1], "update:profiles");
  assert.match(events[2], /^remove:/);
  assert.notEqual(events[2], `remove:${previous.photoPath}`);
});
test("deleting a mannequin keeps the private photo when the profile update fails", async () => {
  const { api, events } = fakeClient({ rowError: true });
  await assert.rejects(() =>
    deleteMannequin(
      owner,
      {
        source: "photo",
        photoPath: `${owner}/mannequin/old.jpg`,
        image: "signed",
        traits: {},
      },
      api,
    ),
  );
  assert.deepEqual(events, ["update:profiles"]);
});
test("failed row deletion keeps the photo", async () => {
  const { api, events } = fakeClient({ rowError: true });
  await assert.rejects(() => deletePiece(piece, owner, api));
  assert.deepEqual(events, ["delete:clothing_items"]);
});
test("successful row deletion reports failed photo cleanup", async () => {
  const { api, events } = fakeClient({ removeError: true });
  assert.deepEqual(await deletePiece(piece, owner, api), {
    cleanupWarning: true,
  });
  assert.deepEqual(events, [
    "delete:clothing_items",
    `remove:${owner}/old.jpg`,
  ]);
});
test("failed outfit items insert rolls back the outfit", async () => {
  const { api, events } = fakeClient({ itemError: true });
  const look: Look = {
    id: "33333333-3333-4333-8333-333333333333",
    pieceIds: [piece.id],
    occasion: "Casual",
    favorite: false,
    createdAt: new Date().toISOString(),
  };
  await assert.rejects(() => saveLook(look, owner, api));
  assert.deepEqual(events, [
    "insert:outfits",
    "insert:outfit_items",
    "delete:outfits",
  ]);
});
test("legacy import IDs are stable and scoped to an account", async () => {
  const first = await legacyId(owner, "demo-0");
  assert.equal(first, await legacyId(owner, "demo-0"));
  assert.notEqual(
    first,
    await legacyId("44444444-4444-4444-8444-444444444444", "demo-0"),
  );
  assert.match(
    first,
    /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
