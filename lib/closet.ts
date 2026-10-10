export const categories = [
  "Blusas",
  "Calças",
  "Saias",
  "Vestidos",
  "Casacos",
  "Calçados",
  "Acessórios",
] as const;
export const occasions = ["Casual", "Trabalho", "Encontro", "Festa"] as const;
export const colors = {
  Branco: "#edece7",
  Preto: "#353533",
  Bege: "#c9b797",
  Azul: "#698798",
  Verde: "#77856c",
  Rosa: "#c39399",
  Marrom: "#926d51",
};
export type Category = (typeof categories)[number];
export type Occasion = (typeof occasions)[number];
export type Piece = {
  id: string;
  name: string;
  category: Category;
  color: keyof typeof colors;
  occasions: Occasion[];
  style?: string;
  photoPath?: string;
  image?: string;
  demo?: boolean;
};
export type Look = {
  id: string;
  pieceIds: string[];
  occasion: Occasion;
  favorite: boolean;
  createdAt: string;
};
export type ClosetData = { version: 1; pieces: Piece[]; looks: Look[] };
export const demoPieces: Piece[] = [
  ["Camisa de linho", "Blusas", "Branco", ["Casual", "Trabalho", "Encontro"]],
  ["Jeans reto", "Calças", "Azul", ["Casual", "Encontro"]],
  ["Blazer essencial", "Casacos", "Bege", ["Trabalho", "Encontro"]],
  ["Tênis clássico", "Calçados", "Branco", ["Casual", "Trabalho", "Encontro"]],
  ["Regata de algodão", "Blusas", "Preto", ["Casual", "Encontro", "Festa"]],
  [
    "Calça de alfaiataria",
    "Calças",
    "Bege",
    ["Casual", "Trabalho", "Encontro", "Festa"],
  ],
  ["Vestido midi", "Vestidos", "Verde", ["Casual", "Encontro", "Festa"]],
  [
    "Sandália de tiras",
    "Calçados",
    "Marrom",
    ["Casual", "Trabalho", "Encontro", "Festa"],
  ],
  [
    "Bolsa de ombro",
    "Acessórios",
    "Marrom",
    ["Casual", "Trabalho", "Encontro", "Festa"],
  ],
  ["Blusa de seda", "Blusas", "Rosa", ["Trabalho", "Encontro", "Festa"]],
  ["Saia midi", "Saias", "Preto", ["Trabalho", "Encontro", "Festa"]],
  ["Mocassim", "Calçados", "Preto", ["Trabalho", "Encontro", "Festa"]],
].map((row, i) => ({
  id: `demo-${i}`,
  name: row[0] as string,
  category: row[1] as Category,
  color: row[2] as Piece["color"],
  occasions: row[3] as Occasion[],
  demo: true,
}));
/** Complete outfits: a dress OR top + bottom, always with shoes. No repeated combinations. */
export function generateLooks(pieces: Piece[], occasion: Occasion): string[][] {
  const eligible = pieces
    .filter((p) => p.occasions.includes(occasion))
    .sort((a, b) => a.id.localeCompare(b.id));
  const tops = eligible.filter((p) => p.category === "Blusas");
  const bottoms = eligible.filter(
    (p) => p.category === "Calças" || p.category === "Saias",
  );
  const bases = [
    ...eligible.filter((p) => p.category === "Vestidos").map((p) => [p]),
    ...tops.flatMap((t) => bottoms.map((b) => [t, b])),
  ];
  const shoes = eligible.filter((p) => p.category === "Calçados");
  const extras = eligible.filter(
    (p) => p.category === "Casacos" || p.category === "Acessórios",
  );
  const neutral = ["Branco", "Preto", "Bege", "Marrom"];
  return bases
    .flatMap((base) => shoes.map((shoe) => [...base, shoe]))
    .sort((a, b) => {
      const score = (items: Piece[]) =>
        items.filter((p) => neutral.includes(p.color)).length;
      return (
        score(b) - score(a) ||
        a
          .map((p) => p.id)
          .join()
          .localeCompare(b.map((p) => p.id).join())
      );
    })
    .slice(0, 3)
    .map((base, i) =>
      [...base, ...(extras[i] ? [extras[i]] : [])].map((p) => p.id),
    );
}
export function findSavedLook(
  looks: Look[],
  candidate: Look,
): Look | undefined {
  return (
    looks.find((look) => look.id === candidate.id) ??
    (candidate.id.startsWith("suggestion-")
      ? looks.find(
          (look) =>
            look.occasion === candidate.occasion &&
            look.pieceIds.length === candidate.pieceIds.length &&
            look.pieceIds.every(
              (id, index) => id === candidate.pieceIds[index],
            ),
        )
      : undefined)
  );
}
export function removePiece(data: ClosetData, id: string): ClosetData {
  return {
    ...data,
    pieces: data.pieces.filter((p) => p.id !== id),
    looks: data.looks.filter((l) => !l.pieceIds.includes(id)),
  };
}
export function isClosetData(value: unknown): value is ClosetData {
  if (!value || typeof value !== "object") return false;
  const d = value as ClosetData;
  return (
    d.version === 1 &&
    Array.isArray(d.pieces) &&
    Array.isArray(d.looks) &&
    d.pieces.every(
      (p) =>
        p !== null &&
        typeof p === "object" &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        categories.includes(p.category) &&
        Object.hasOwn(colors, p.color) &&
        Array.isArray(p.occasions) &&
        p.occasions.every((o) => occasions.includes(o)),
    ) &&
    d.looks.every(
      (l) =>
        l !== null &&
        typeof l === "object" &&
        typeof l.id === "string" &&
        typeof l.favorite === "boolean" &&
        typeof l.createdAt === "string" &&
        occasions.includes(l.occasion) &&
        Array.isArray(l.pieceIds) &&
        l.pieceIds.every((id) => d.pieces.some((p) => p.id === id)),
    )
  );
}
