import { test, expect } from "@playwright/test";

test("separate demo retains five screens and never enters the personal closet", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Bem-vinda ao seu closet/ }),
  ).toBeVisible();
  await expect(page.locator(".auth-card .alert.error")).toContainText(
    "Supabase ainda não configurado",
  );
  await page.getByRole("button", { name: "Ver demonstração" }).click();
  await expect(
    page.getByText(/Modo demonstração: peças fictícias/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Seu estilo/ })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await expect(page.locator(".piece-card")).toHaveCount(12);
  await page.getByLabel("Buscar peça pelo nome").fill("camisa");
  await expect(page.locator(".piece-card")).toHaveCount(1);
  await page.locator(".piece-card").click();
  await expect(page.getByRole("dialog")).toContainText("PEÇA DE DEMONSTRAÇÃO");
  await expect(page.getByRole("button", { name: "Excluir peça" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("conta pessoal");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Montar look", exact: true })
    .click();
  await page.getByRole("button", { name: "Gerar 3 combinações" }).click();
  await expect(page.locator(".look-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Salvar look como favorito" })
    .first()
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Meus looks", exact: true })
    .click();
  await page.getByRole("button", { name: /Favoritos · 1/ }).click();
  await expect(page.locator(".look-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      async () =>
        !(await indexedDB.databases()).some(
          (db) => db.name === "meu-closet-ai",
        ),
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Bem-vinda ao seu closet/ }),
  ).toBeVisible();
});

test("PWA manifest is available without Supabase credentials", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Meu Closet AI");
  expect(manifest.display).toBe("standalone");
  expect((await request.get("/sw.js")).status()).toBe(200);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker?.getRegistration()),
      ),
    )
    .toBe(true);
});
