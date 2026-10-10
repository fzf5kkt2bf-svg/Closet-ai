import { type ClosetData, demoPieces, isClosetData } from "./closet";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("meu-closet-ai", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("closet");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Feche outras abas do aplicativo e tente novamente."));
  });
}
export async function readData(): Promise<ClosetData> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("closet")
        .objectStore("closet")
        .get("data");
      request.onsuccess = () => {
        if (request.result === undefined)
          resolve({ version: 1, pieces: demoPieces, looks: [] });
        else if (isClosetData(request.result)) resolve(request.result);
        else reject(new Error("Dados locais inválidos."));
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function writeData(data: ClosetData): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("closet", "readwrite");
      tx.objectStore("closet").put(data, "data");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
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
