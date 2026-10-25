import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/catalog-image/route";
import { catalogPrompt } from "../lib/catalog-image";

test("catalog route refuses unauthenticated and malformed requests before generation", async () => {
  const old = {
    gateway: process.env.AI_GATEWAY_API_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.AI_GATEWAY_API_KEY = "test-only";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  try {
    const anonymous = await POST(
      new Request("http://localhost/api/catalog-image", {
        method: "POST",
        body: JSON.stringify({
          pieceId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    assert.equal(anonymous.status, 401);
    const malformed = await POST(
      new Request("http://localhost/api/catalog-image", {
        method: "POST",
        headers: { authorization: "Bearer test-only" },
        body: JSON.stringify({ pieceId: "wrong" }),
      }),
    );
    assert.equal(malformed.status, 400);
  } finally {
    if (old.gateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = old.gateway;
    if (old.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = old.url;
    if (old.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = old.key;
  }
});

test("catalog prompt asks to preserve the photographed piece", () => {
  const prompt = catalogPrompt({
    name: "Calça verde",
    category: "Calças",
    color: "Verde",
    style: "Casual",
  });
  assert.match(prompt, /Preserve|preserve/);
  assert.match(prompt, /folds/);
  assert.match(prompt, /Calça verde/);
});
