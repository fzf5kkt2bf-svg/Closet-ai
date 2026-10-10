import { test, expect } from "@playwright/test";

test("catalog, photo CRUD, generation, favorites and local persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Seu estilo/ })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await expect(page.locator(".piece-card")).toHaveCount(12);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByLabel("Nome da peça").fill("Camisa de teste");
  await page
    .locator("input[type=file]:not([capture])")
    .setInputFiles("public/icon-192.png");
  await expect(page.locator(".upload-preview img")).toBeVisible();
  await page.getByRole("button", { name: "Salvar peça", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Peça salva");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await page.getByLabel("Buscar peça pelo nome").fill("camisa de teste");
  await expect(page.locator(".piece-card")).toHaveCount(1);
  await expect(page.locator(".piece-card img")).toBeVisible();
  await page.locator(".piece-card").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Editar peça", exact: true }).click();
  await page.getByLabel("Nome da peça").fill("Camisa editada");
  await page.getByRole("button", { name: "Salvar peça", exact: true }).click();
  await page.getByLabel("Buscar peça pelo nome").fill("camisa editada");
  await expect(page.locator(".piece-card")).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Montar look", exact: true })
    .click();
  await page.getByRole("button", { name: "Gerar 3 combinações" }).click();
  await expect(page.locator(".look-card")).toHaveCount(3);
  expect(
    await page.locator(".look-collage").evaluateAll((cards) =>
      cards.every((card) => {
        const box = card.getBoundingClientRect();
        return [...card.querySelectorAll(":scope > div")].every(
          (item) => item.getBoundingClientRect().bottom <= box.bottom,
        );
      }),
    ),
  ).toBe(true);
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
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Meus looks", exact: true })
    .click();
  await expect(page.locator(".look-card")).toHaveCount(3);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await page.getByLabel("Buscar peça pelo nome").fill("camisa editada");
  await page.locator(".piece-card").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir peça", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".piece-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("empty closet stays empty across reload and never generates phantom pieces", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Seu estilo/ })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("meu-closet-ai", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("closet");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("closet", "readwrite");
      tx.objectStore("closet").put(
        { version: 1, pieces: [], looks: [] },
        "data",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guarda-roupa", exact: true })
    .click();
  await expect(page.locator(".piece-card")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Montar look", exact: true })
    .click();
  await page.getByRole("button", { name: "Gerar 3 combinações" }).click();
  await expect(page.getByRole("status")).toContainText("cadastre");
  await expect(page.locator(".look-card")).toHaveCount(0);
});
