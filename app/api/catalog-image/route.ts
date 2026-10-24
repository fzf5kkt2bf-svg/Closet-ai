import { generateImage } from "ai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { catalogPrompt } from "@/lib/catalog-image";
import { PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 120;

function reply(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply("Supabase não configurado.", 503);
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply("Entre na sua conta para continuar.", 401);
  let pieceId: string;
  try {
    const body = await request.json();
    pieceId = body.pieceId;
    if (
      typeof pieceId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        pieceId,
      )
    )
      return reply("Peça inválida.", 400);
  } catch {
    return reply("Pedido inválido.", 400);
  }
  const api = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await api.auth.getUser(token);
  if (authError || !auth.user)
    return reply("Sua sessão expirou. Entre novamente.", 401);
  const { data: item, error: itemError } = await api
    .from("clothing_items")
    .select("id,user_id,name,category,color,style,photo_path")
    .eq("id", pieceId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (itemError) return reply("Não foi possível consultar a peça.", 502);
  if (!item?.photo_path)
    return reply(
      "Salve uma foto original antes de gerar a versão de catálogo.",
      404,
    );
  const { data: original, error: downloadError } = await api.storage
    .from(PHOTO_BUCKET)
    .download(item.photo_path);
  if (downloadError || !original)
    return reply("Não foi possível abrir a foto original.", 502);
  if (original.size > 6 * 1024 * 1024) return reply("A foto excede 6 MB.", 413);
  try {
    const source = new Uint8Array(await original.arrayBuffer());
    const { image } = await generateImage({
      model: "openai/gpt-image-2.5-sunburst",
      prompt: { text: catalogPrompt(item), images: [source] },
      size: "1024x1024",
      abortSignal: AbortSignal.timeout(100_000),
    });
    const jpeg = await sharp(Buffer.from(image.uint8Array))
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#f8f7f3" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    // JSON/base64 adds ~33%; stay below the Vercel response size limit.
    if (jpeg.length > 3 * 1024 * 1024)
      return reply("A imagem gerada ficou grande demais.", 502);
    return Response.json(
      { image: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    const status =
      cause && typeof cause === "object" && "statusCode" in cause
        ? Number(cause.statusCode)
        : undefined;
    console.error("catalog-image generation failed", { status });
    if (status === 401 || status === 403)
      return reply(
        "O AI Gateway não autorizou a geração. Confira a configuração na Vercel.",
        502,
      );
    if (status === 402)
      return reply("O AI Gateway está sem créditos para gerar imagens.", 502);
    if (status === 429)
      return reply(
        "O limite de gerações foi atingido. Tente novamente mais tarde.",
        429,
      );
    return reply(
      "A geração falhou. Sua foto original foi preservada; tente novamente mais tarde.",
      502,
    );
  }
}
