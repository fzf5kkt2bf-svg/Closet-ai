import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoPieces,
  generateLooks,
  removePiece,
  isClosetData,
  occasions,
  type ClosetData,
} from "../lib/closet";
test("all occasions generate three unique, complete outfits from eligible pieces only", () => {
  for (const o of occasions) {
    const looks = generateLooks(demoPieces, o);
    assert.equal(looks.length, 3);
    assert.equal(new Set(looks.map((l) => [...l].sort().join())).size, 3);
    for (const ids of looks) {
      const pieces = ids.map((id) => demoPieces.find((p) => p.id === id)!);
      assert(pieces.every((p) => p.occasions.includes(o)));
      assert(pieces.some((p) => p.category === "Calçados"));
      assert(
        pieces.some((p) => p.category === "Vestidos") ||
          (pieces.some((p) => p.category === "Blusas") &&
            pieces.some((p) => ["Calças", "Saias"].includes(p.category))),
      );
    }
    assert.deepEqual(looks, generateLooks([...demoPieces].reverse(), o));
  }
});
test("never invents outfits or duplicates when pieces are insufficient", () => {
  assert.deepEqual(generateLooks([], "Casual"), []);
  assert.deepEqual(
    generateLooks(
      demoPieces.filter((p) => p.category !== "Calçados"),
      "Casual",
    ),
    [],
  );
  const subset = demoPieces.filter((p) =>
    ["demo-0", "demo-1", "demo-3"].includes(p.id),
  );
  assert.equal(generateLooks(subset, "Casual").length, 1);
  assert.equal(generateLooks(subset, "Festa").length, 0);
});
test("deletion removes dependent looks and preserves unrelated looks", () => {
  const data: ClosetData = {
    version: 1,
    pieces: demoPieces,
    looks: [
      {
        id: "a",
        pieceIds: ["demo-0"],
        occasion: "Casual",
        favorite: true,
        createdAt: "2026-10-10",
      },
      {
        id: "b",
        pieceIds: ["demo-1"],
        occasion: "Casual",
        favorite: false,
        createdAt: "2026-10-10",
      },
    ],
  };
  const next = removePiece(data, "demo-0");
  assert.equal(next.pieces.length, 11);
  assert.deepEqual(
    next.looks.map((l) => l.id),
    ["b"],
  );
  assert.equal(data.pieces.length, 12);
});
test("validates stored schema and dangling references", () => {
  assert(isClosetData({ version: 1, pieces: demoPieces, looks: [] }));
  assert(!isClosetData({ version: 2, pieces: [], looks: [] }));
  assert(!isClosetData({ version: 1, pieces: [{}], looks: [] }));
  assert(
    !isClosetData({
      version: 1,
      pieces: [],
      looks: [
        {
          id: "a",
          pieceIds: ["missing"],
          occasion: "Casual",
          favorite: false,
          createdAt: "date",
        },
      ],
    }),
  );
});
