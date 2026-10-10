import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const userId = "11111111-1111-4111-8111-111111111111";
const email = "pessoa@example.test";
function token() {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}
test("email signup, login and personal closet using simulated Supabase", async ({
  page,
}) => {
  test.setTimeout(60000);
  const user = {
    id: userId,
    email,
    role: "authenticated",
    aud: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: "Pessoa" },
    created_at: new Date().toISOString(),
  };
  let row: Record<string, unknown> | null = null;
  let uploadedPath = "";
  let removedPath = "";
  const sampleImage = await readFile("public/icon-192.png");
  await page.route("http://127.0.0.1:3999/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info,prefer",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
        body: JSON.stringify(body),
      });
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info,prefer",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
    if (path === "/auth/v1/signup") return respond({ user, session: null });
    if (path === "/auth/v1/token")
      return respond({
        access_token: token(),
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fake-refresh",
        user,
      });
    if (path === "/auth/v1/user") return respond(user);
    if (path === "/auth/v1/logout") return respond({});
    if (path === "/auth/v1/recover") return respond({});
    if (
      path.startsWith("/storage/v1/object/sign/") &&
      request.method() === "POST"
    )
      return respond({
        signedURL: `/object/sign/clothing-photos-private/${uploadedPath}?token=test`,
      });
    if (
      path.startsWith("/storage/v1/object/sign/") &&
      request.method() === "GET"
    )
      return route.fulfill({
        status: 200,
        body: sampleImage,
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      });
    if (
      path.startsWith("/storage/v1/object/clothing-photos-private/") &&
      request.method() === "POST"
    ) {
      uploadedPath = decodeURIComponent(
        path.split("/clothing-photos-private/")[1],
      );
      return respond({ Key: uploadedPath });
    }
    if (
      path === "/storage/v1/object/clothing-photos-private" &&
      request.method() === "DELETE"
    ) {
      removedPath = (request.postDataJSON() as { prefixes: string[] })
        .prefixes[0];
      return respond([]);
    }
    if (path === "/rest/v1/clothing_items" && request.method() === "GET")
      return respond(row ? [row] : []);
    if (path === "/rest/v1/clothing_items" && request.method() === "POST") {
      const created = request.postDataJSON() as Record<string, unknown>;
      row = created;
      return respond({ id: created.id }, 201);
    }
    if (path === "/rest/v1/clothing_items" && request.method() === "PATCH") {
      const updated = { ...row, ...request.postDataJSON() };
      row = updated;
      return respond({ id: updated.id });
    }
    if (path === "/rest/v1/clothing_items" && request.method() === "DELETE") {
      const id = row?.id;
      row = null;
      return respond({ id });
    }
    if (path === "/rest/v1/outfits") return respond([]);
    return respond({ message: `Rota simulada ausente: ${path}` }, 404);
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome (opcional)").fill("Pessoa");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).last().click();
  await expect(page.getByRole("status")).toContainText("Confira seu e-mail");
  await page.getByRole("button", { name: "Voltar para login" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-teste-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText(/Closet pessoal: peças e fotos privadas/),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await expect(page.locator(".piece-card")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByLabel("Nome da peça").fill("Blusa pessoal");
  await page.getByLabel("Categoria").selectOption("Blusas");
  await page.getByRole("combobox", { name: "Cor" }).selectOption("Azul");
  await page.getByLabel("Estilo (opcional)").fill("Casual");
  await page
    .locator("input[type=file]:not([capture])")
    .setInputFiles("public/icon-192.png");
  await expect(page.locator(".upload-preview img")).toBeVisible();
  await page.getByRole("button", { name: "Salvar peça" }).click();
  await expect(page.locator(".piece-card")).toHaveCount(1);
  await expect(page.locator(".piece-card")).toContainText("Blusa pessoal");
  await expect(page.locator(".piece-card img")).toBeVisible();
  expect(uploadedPath).toMatch(new RegExp(`^${userId}/`));
  await page.locator(".piece-card").click();
  await page.getByRole("button", { name: "Editar peça" }).click();
  await page.getByLabel("Nome da peça").fill("Blusa editada");
  await page.getByRole("button", { name: "Salvar peça" }).click();
  await expect(page.locator(".piece-card")).toContainText("Blusa editada");
  await page.locator(".piece-card").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir peça" }).click();
  await expect(page.locator(".piece-card")).toHaveCount(0);
  expect(removedPath).toBe(uploadedPath);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(
    page.getByRole("heading", { name: /Bem-vinda ao seu closet/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Se este e-mail estiver cadastrado",
  );
  await page.goto(
    `/#access_token=${token()}&token_type=bearer&expires_in=3600&refresh_token=fake-refresh&type=recovery`,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nova senha" })).toBeVisible();
  await page.getByLabel("Nova senha").fill("nova-senha-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("status")).toContainText("Senha atualizada");
});
