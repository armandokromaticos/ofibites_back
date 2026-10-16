import {
  evaluateLineAvailability,
  LineAvailabilitySnapshot,
} from "./line-availability";

const base = (
  overrides: Partial<LineAvailabilitySnapshot["line"]> = {},
): LineAvailabilitySnapshot["line"] => ({
  productId: "p-1",
  productSizeId: null,
  comboId: null,
  modifierIds: [],
  ...overrides,
});

const product = { isActive: true, hasActiveSizes: false };
const modifier = {
  id: "m-1",
  isActive: true,
  groupProductId: "p-1",
  sizeRestricted: false,
  pricedSizeIds: [] as string[],
};

describe("evaluateLineAvailability", () => {
  it.each<[string, LineAvailabilitySnapshot, string | null]>([
    ["todo activo", { line: base(), product }, null],
    ["producto inexistente", { line: base(), product: null }, "NOT_FOUND"],
    [
      "producto inactivo",
      { line: base(), product: { ...product, isActive: false } },
      "UNAVAILABLE",
    ],
    [
      "tamaño inexistente",
      { line: base({ productSizeId: "s-1" }), product, size: null },
      "NOT_FOUND",
    ],
    [
      "tamaño inactivo",
      {
        line: base({ productSizeId: "s-1" }),
        product,
        size: { productId: "p-1", isActive: false },
      },
      "CONFIGURATION",
    ],
    [
      "tamaño de otro producto",
      {
        line: base({ productSizeId: "s-1" }),
        product,
        size: { productId: "p-9", isActive: true },
      },
      "CONFIGURATION",
    ],
    [
      "sin tamaño con tamaños activos",
      { line: base(), product: { ...product, hasActiveSizes: true } },
      "CONFIGURATION",
    ],
    [
      "modificador inexistente",
      { line: base({ modifierIds: ["m-1"] }), product, modifiers: [] },
      "NOT_FOUND",
    ],
    [
      "modificador inactivo",
      {
        line: base({ modifierIds: ["m-1"] }),
        product,
        modifiers: [{ ...modifier, isActive: false }],
      },
      "CONFIGURATION",
    ],
    [
      "modificador de otro producto",
      {
        line: base({ modifierIds: ["m-1"] }),
        product,
        modifiers: [{ ...modifier, groupProductId: "p-9" }],
      },
      "CONFIGURATION",
    ],
    [
      "sizeRestricted sin precio para el tamaño",
      {
        line: base({ productSizeId: "s-1", modifierIds: ["m-1"] }),
        product,
        size: { productId: "p-1", isActive: true },
        modifiers: [{ ...modifier, sizeRestricted: true }],
      },
      "CONFIGURATION",
    ],
    [
      "sizeRestricted con precio para el tamaño",
      {
        line: base({ productSizeId: "s-1", modifierIds: ["m-1"] }),
        product,
        size: { productId: "p-1", isActive: true },
        modifiers: [
          { ...modifier, sizeRestricted: true, pricedSizeIds: ["s-1"] },
        ],
      },
      null,
    ],
    [
      "combo activo con el producto dentro",
      {
        line: base({ comboId: "c-1" }),
        combo: { isActive: true, productIds: ["p-1"] },
      },
      null,
    ],
    [
      "combo inexistente",
      { line: base({ comboId: "c-1" }), combo: null },
      "NOT_FOUND",
    ],
    [
      "combo inactivo",
      {
        line: base({ comboId: "c-1" }),
        combo: { isActive: false, productIds: ["p-1"] },
      },
      "UNAVAILABLE",
    ],
    [
      "producto fuera del combo",
      {
        line: base({ comboId: "c-1" }),
        combo: { isActive: true, productIds: ["p-9"] },
      },
      "UNAVAILABLE",
    ],
    [
      "combo con modificadores",
      {
        line: base({ comboId: "c-1", modifierIds: ["m-1"] }),
        combo: { isActive: true, productIds: ["p-1"] },
      },
      "CONFIGURATION",
    ],
    [
      "combo con tamaño",
      {
        line: base({ comboId: "c-1", productSizeId: "s-1" }),
        combo: { isActive: true, productIds: ["p-1"] },
      },
      "CONFIGURATION",
    ],
  ])("%s → %s", (_caso, snapshot, code) => {
    const result = evaluateLineAvailability(snapshot);
    expect(result?.code ?? null).toBe(code);
  });

  it("un combo no mira el producto ancla", () => {
    expect(
      evaluateLineAvailability({
        line: base({ comboId: "c-1" }),
        product: { isActive: false, hasActiveSizes: true },
        combo: { isActive: true, productIds: ["p-1"] },
      }),
    ).toBeNull();
  });
});
