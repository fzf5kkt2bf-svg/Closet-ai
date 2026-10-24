import { type ClosetData, isClosetData } from "./closet";

/** Read the V1 database without changing or deleting its contents. */
export async function readLegacyData(): Promise<ClosetData | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("meu-closet-ai", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("closet");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("closet").objectStore("closet").get("data");
      req.onsuccess = () => {
        if (req.result === undefined) resolve(null);
        else if (isClosetData(req.result)) resolve(req.result);
        else reject(new Error("Os dados locais da V1 estão inválidos."));
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Escolha uma foto de até 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a foto.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    throw new Error(
      "Não foi possível abrir a foto. Tente uma imagem JPEG, PNG ou WebP.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
