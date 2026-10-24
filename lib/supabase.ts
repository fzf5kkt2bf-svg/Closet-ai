import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  categories,
  colors,
  occasions,
  type ClosetData,
  type Look,
  type Piece,
  type Occasion,
} from "./closet";

export const PHOTO_BUCKET = "clothing-photos-private";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabaseConfigured = Boolean(url && key);
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!url || !key)
    throw new Error(
      "Configure as variáveis públicas do Supabase antes de usar o closet pessoal.",
    );
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

type ItemRow = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  color: string;
  style: string;
  occasions: string[];
  photo_path: string | null;
  enhanced_photo_path: string | null;
};
type OutfitRow = {
  id: string;
  occasion: string;
  favorite: boolean;
  created_at: string;
  outfit_items: { clothing_item_id: string; position: number }[];
};
function fromItem(row: ItemRow, image?: string, enhancedImage?: string): Piece {
  if (
    !categories.includes(row.category as Piece["category"]) ||
    !Object.hasOwn(colors, row.color) ||
    !row.occasions.every((o) => occasions.includes(o as Occasion))
  )
    throw new Error("O banco retornou uma peça com dados inválidos.");
  return {
    id: row.id,
    name: row.name,
    category: row.category as Piece["category"],
    color: row.color as Piece["color"],
    style: row.style,
    occasions: row.occasions as Occasion[],
    photoPath: row.photo_path ?? undefined,
    image,
    enhancedPhotoPath: row.enhanced_photo_path ?? undefined,
    enhancedImage,
  };
}
function fromOutfit(row: OutfitRow): Look {
  return {
    id: row.id,
    occasion: row.occasion as Occasion,
    favorite: row.favorite,
    createdAt: row.created_at,
    pieceIds: [...row.outfit_items]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.clothing_item_id),
  };
}
export async function loadCloset(
  userId: string,
  api: SupabaseClient = getSupabase(),
): Promise<ClosetData> {
  const [itemsResult, outfitsResult] = await Promise.all([
    api
      .from("clothing_items")
      .select(
        "id,user_id,name,category,color,style,occasions,photo_path,enhanced_photo_path",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    api
      .from("outfits")
      .select(
        "id,occasion,favorite,created_at,outfit_items(clothing_item_id,position)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (outfitsResult.error) throw outfitsResult.error;
  const rows = itemsResult.data as ItemRow[];
  const signedImage = async (path: string | null) => {
    if (!path) return undefined;
    const { data, error } = await api.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 600);
    if (error) return undefined;
    return data.signedUrl;
  };
  const images = await Promise.all(
    rows.map(async (row) =>
      Promise.all([
        signedImage(row.photo_path),
        signedImage(row.enhanced_photo_path),
      ]),
    ),
  );
  const pieces = rows.map((row, i) =>
    fromItem(row, images[i][0], images[i][1]),
  );
  const ids = new Set(pieces.map((p) => p.id));
  const looks = (outfitsResult.data as OutfitRow[])
    .map(fromOutfit)
    .filter(
      (l) => l.pieceIds.length > 0 && l.pieceIds.every((id) => ids.has(id)),
    );
  return { version: 1, pieces, looks };
}
export type MutationResult = { cleanupWarning: boolean };
async function removePhoto(
  path: string,
  api: SupabaseClient,
): Promise<boolean> {
  const { error } = await api.storage.from(PHOTO_BUCKET).remove([path]);
  return !error;
}
/** Upload a new image before updating the row; roll back the upload if the row write fails. */
export async function savePiece(
  piece: Piece,
  userId: string,
  original?: Piece,
  api: SupabaseClient = getSupabase(),
): Promise<MutationResult> {
  const uploadedPaths: string[] = [];
  let photoPath = piece.photoPath ?? null;
  let enhancedPhotoPath = piece.enhancedPhotoPath ?? null;
  const upload = async (dataUrl: string): Promise<string> => {
    const path = `${userId}/${piece.id}/${crypto.randomUUID()}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    uploadedPaths.push(path);
    const { error } = await api.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "0",
    });
    if (error) throw error;
    return path;
  };
  try {
    if (piece.image?.startsWith("data:image/"))
      photoPath = await upload(piece.image);
    else if (!piece.image && !piece.photoPath) photoPath = null;
    if (photoPath && piece.enhancedImage?.startsWith("data:image/"))
      enhancedPhotoPath = await upload(piece.enhancedImage);
    else if (!photoPath || (!piece.enhancedImage && !piece.enhancedPhotoPath))
      enhancedPhotoPath = null;
  } catch (cause) {
    for (const path of uploadedPaths) await removePhoto(path, api);
    throw cause;
  }
  const payload = {
    id: piece.id,
    user_id: userId,
    name: piece.name.trim(),
    category: piece.category,
    color: piece.color,
    style: (piece.style ?? "").trim(),
    occasions: piece.occasions,
    photo_path: photoPath,
    enhanced_photo_path: enhancedPhotoPath,
  };
  let result;
  try {
    result = original
      ? await api
          .from("clothing_items")
          .update(payload)
          .eq("id", piece.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await api.from("clothing_items").insert(payload).select("id").single();
  } catch (cause) {
    const cleaned = await Promise.all(
      uploadedPaths.map((path) => removePhoto(path, api)),
    );
    if (cleaned.some((ok) => !ok))
      throw new Error(
        "Peça não salva. O novo arquivo pode precisar de limpeza no Storage.",
      );
    throw cause;
  }
  if (result.error) {
    const cleaned = await Promise.all(
      uploadedPaths.map((path) => removePhoto(path, api)),
    );
    if (cleaned.some((ok) => !ok))
      throw new Error(
        "Peça não salva. O novo arquivo pode precisar de limpeza no Storage.",
      );
    throw result.error;
  }
  const oldPaths = [original?.photoPath, original?.enhancedPhotoPath]
    .filter((path): path is string => Boolean(path))
    .filter((path) => path !== photoPath && path !== enhancedPhotoPath);
  const removed = await Promise.all(
    [...new Set(oldPaths)].map((path) => removePhoto(path, api)),
  );
  return {
    cleanupWarning: removed.some((ok) => !ok),
  };
}
export async function deletePiece(
  piece: Piece,
  userId: string,
  api: SupabaseClient = getSupabase(),
): Promise<MutationResult> {
  const { error, data } = await api
    .from("clothing_items")
    .delete()
    .eq("id", piece.id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Peça não encontrada.");
  const paths = [
    ...new Set(
      [piece.photoPath, piece.enhancedPhotoPath].filter(
        (path): path is string => Boolean(path),
      ),
    ),
  ];
  const removed = await Promise.all(
    paths.map((path) => removePhoto(path, api)),
  );
  return { cleanupWarning: removed.some((ok) => !ok) };
}
export async function saveLook(
  look: Look,
  userId: string,
  api: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await api.from("outfits").insert({
    id: look.id,
    user_id: userId,
    occasion: look.occasion,
    favorite: look.favorite,
  });
  if (error) throw error;
  const items = look.pieceIds.map((id, position) => ({
    user_id: userId,
    outfit_id: look.id,
    clothing_item_id: id,
    position,
  }));
  const result = await api.from("outfit_items").insert(items);
  if (result.error) {
    const rollback = await api
      .from("outfits")
      .delete()
      .eq("id", look.id)
      .eq("user_id", userId);
    if (rollback.error)
      throw new Error(
        "Não foi possível completar o look. Um registro incompleto pode precisar de limpeza.",
      );
    throw result.error;
  }
}
export async function updateFavorite(
  id: string,
  favorite: boolean,
  userId: string,
  api: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error, data } = await api
    .from("outfits")
    .update({ favorite })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Look não encontrado.");
}
export async function deleteLook(
  id: string,
  userId: string,
  api: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error, data } = await api
    .from("outfits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Look não encontrado.");
}

/** Deterministic per-account IDs make the optional V1 import safe to retry. */
export async function legacyId(userId: string, oldId: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`meu-closet-ai-v1:${userId}:${oldId}`),
    ),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
export async function importLegacyCloset(
  legacy: ClosetData,
  userId: string,
): Promise<{ pieces: number; looks: number }> {
  const current = await loadCloset(userId);
  const pieceIds = new Set(current.pieces.map((p) => p.id));
  const outfitIds = new Set(current.looks.map((l) => l.id));
  const real = legacy.pieces.filter((p) => !p.demo);
  const idMap = new Map<string, string>();
  for (const piece of real)
    idMap.set(piece.id, await legacyId(userId, piece.id));
  let pieces = 0,
    looks = 0;
  for (const piece of real) {
    const id = idMap.get(piece.id)!;
    if (pieceIds.has(id)) continue;
    await savePiece(
      { ...piece, id, demo: false, photoPath: undefined },
      userId,
    );
    pieceIds.add(id);
    pieces++;
  }
  for (const look of legacy.looks) {
    if (!look.pieceIds.every((id) => idMap.has(id))) continue;
    const id = await legacyId(userId, look.id);
    if (outfitIds.has(id)) continue;
    await saveLook(
      {
        ...look,
        id,
        pieceIds: look.pieceIds.map((oldId) => idMap.get(oldId)!),
      },
      userId,
    );
    outfitIds.add(id);
    looks++;
  }
  return { pieces, looks };
}
