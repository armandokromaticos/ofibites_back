import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  LineItemInput,
  LineItemPricingService,
} from "./line-item-pricing.service";
import type { IProductRepository } from "../../domain/repositories/product.repository.interface";
import type { IProductSizeRepository } from "../../domain/repositories/product-size.repository.interface";
import type { IProductModifierRepository } from "../../domain/repositories/product-modifier.repository.interface";
import type { IProductModifierGroupRepository } from "../../domain/repositories/product-modifier-group.repository.interface";
import type { IComboRepository } from "../../domain/repositories/combo.repository.interface";

// Catálogo de prueba (solo los getters que lee el servicio).
const PRODUCTS = [
  { id: "p-1", basePrice: 10 },
  { id: "p-2", basePrice: 20 },
];
const SIZES = [
  { id: "s-1", productId: "p-1", price: 12 },
  { id: "s-2", productId: "p-2", price: 25 },
  { id: "s-3", productId: "p-1", price: 11 },
];
const COMBOS = [{ id: "c-1", price: 30 }];
const MODIFIERS = [
  { id: "m-1", groupId: "g-1", priceAdjustment: 1, sizeRestricted: false },
  { id: "m-2", groupId: "g-1", priceAdjustment: 2, sizeRestricted: true },
  { id: "m-3", groupId: "g-2", priceAdjustment: 3, sizeRestricted: false },
];
const GROUPS = [
  { id: "g-1", productId: "p-1" },
  { id: "g-2", productId: "p-2" },
];
/** m-2 solo tiene precio en s-1. */
const SIZE_PRICES: [string, string, number][] = [["s-1", "m-2", 2.5]];

type WhereIn = { where: { id: { in: string[] } } };
const filtered =
  <T extends { id: string }>(rows: T[]) =>
  (args: WhereIn) =>
    Promise.resolve({
      data: rows.filter((row) => args.where.id.in.includes(row.id)),
    });

function setup() {
  const repos = {
    product: { findMany: jest.fn(filtered(PRODUCTS)) },
    size: { findMany: jest.fn(filtered(SIZES)) },
    combo: { findMany: jest.fn(filtered(COMBOS)) },
    modifier: {
      findMany: jest.fn(filtered(MODIFIERS)),
      findSizePricesBatch: jest.fn(
        (modifierIds: string[], productSizeIds: string[]) => {
          const bySize = new Map<string, Map<string, number>>();
          for (const [sizeId, modifierId, price] of SIZE_PRICES) {
            if (
              !productSizeIds.includes(sizeId) ||
              !modifierIds.includes(modifierId)
            ) {
              continue;
            }
            const prices = bySize.get(sizeId) ?? new Map<string, number>();
            prices.set(modifierId, price);
            bySize.set(sizeId, prices);
          }
          return Promise.resolve(bySize);
        },
      ),
    },
    group: { findMany: jest.fn(() => Promise.resolve({ data: GROUPS })) },
  };
  const service = new LineItemPricingService(
    repos.product as unknown as IProductRepository,
    repos.size as unknown as IProductSizeRepository,
    repos.modifier as unknown as IProductModifierRepository,
    repos.group as unknown as IProductModifierGroupRepository,
    repos.combo as unknown as IComboRepository,
  );
  const queryCount = () =>
    [
      repos.product.findMany,
      repos.size.findMany,
      repos.combo.findMany,
      repos.modifier.findMany,
      repos.modifier.findSizePricesBatch,
      repos.group.findMany,
    ].reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  return { service, repos, queryCount };
}

const mods = (...ids: string[]) => ids.map((modifierId) => ({ modifierId }));

const OK_LINES: LineItemInput[] = [
  // (12 + 1 + 2,5) × 2
  {
    productId: "p-1",
    productSizeId: "s-1",
    quantity: 2,
    modifiers: mods("m-1", "m-2"),
  },
  // (20 + 3) × 1
  { productId: "p-2", quantity: 1, modifiers: mods("m-3") },
  // 30 × 3
  { productId: "p-1", comboId: "c-1", quantity: 3 },
];

const FAILING: [string, LineItemInput, typeof NotFoundException, string][] = [
  [
    "producto inexistente",
    { productId: "p-x", quantity: 1 },
    NotFoundException,
    "Product with id p-x not found",
  ],
  [
    "combo inexistente",
    { productId: "p-1", comboId: "c-x", quantity: 1 },
    NotFoundException,
    "Combo with id c-x not found",
  ],
  [
    "tamaño inexistente",
    { productId: "p-1", productSizeId: "s-x", quantity: 1 },
    NotFoundException,
    "ProductSize with id s-x not found",
  ],
  [
    "modificador inexistente",
    { productId: "p-1", quantity: 1, modifiers: mods("m-x") },
    NotFoundException,
    "ProductModifier with id m-x not found",
  ],
  [
    "combo y tamaño a la vez",
    { productId: "p-1", comboId: "c-1", productSizeId: "s-1", quantity: 1 },
    BadRequestException,
    "comboId and productSizeId cannot both be provided",
  ],
  [
    "tamaño de otro producto",
    { productId: "p-1", productSizeId: "s-2", quantity: 1 },
    BadRequestException,
    "ProductSize s-2 does not belong to product p-1",
  ],
  [
    "modificador de otro producto",
    { productId: "p-1", quantity: 1, modifiers: mods("m-3") },
    BadRequestException,
    "ProductModifier m-3 does not belong to product p-1",
  ],
  [
    "modificador sin precio para el tamaño",
    {
      productId: "p-1",
      productSizeId: "s-3",
      quantity: 1,
      modifiers: mods("m-2"),
    },
    BadRequestException,
    "Modifier m-2 is not available for the selected size",
  ],
];

describe("LineItemPricingService", () => {
  it("cotiza en lote igual que línea a línea", async () => {
    const batch = await setup().service.priceLines(OK_LINES);

    expect(batch).toEqual([
      {
        unitPrice: 12,
        subtotal: 31,
        modifiers: [
          { modifierId: "m-1", priceAdjustment: 1 },
          { modifierId: "m-2", priceAdjustment: 2.5 },
        ],
      },
      {
        unitPrice: 20,
        subtotal: 23,
        modifiers: [{ modifierId: "m-3", priceAdjustment: 3 }],
      },
      { unitPrice: 30, subtotal: 90, modifiers: [] },
    ]);
    for (const [index, input] of OK_LINES.entries()) {
      await expect(setup().service.priceLineItem(input)).resolves.toEqual(
        batch[index],
      );
    }
  });

  it.each(FAILING)(
    "%s: mismo error en lote que línea a línea",
    async (_label, input, type, message) => {
      await expect(setup().service.priceLineItem(input)).rejects.toThrow(
        new type(message),
      );
      const run = setup().service.priceLines([...OK_LINES, input]);
      await expect(run).rejects.toBeInstanceOf(type);
      await expect(run).rejects.toThrow(message);
    },
  );

  it("si fallan la línea 2 y la 3, sale el error de la 2", async () => {
    const comboMissing = FAILING[1][1];
    const sizeOfOther = FAILING[5][1];

    await expect(
      setup().service.priceLines([OK_LINES[0], comboMissing, sizeOfOther]),
    ).rejects.toThrow("Combo with id c-x not found");
    await expect(
      setup().service.priceLines([OK_LINES[0], sizeOfOther, comboMissing]),
    ).rejects.toThrow("ProductSize s-2 does not belong to product p-1");
  });

  it("priceLinesSettled devuelve un resultado por línea, en orden", async () => {
    const results = await setup().service.priceLinesSettled([
      OK_LINES[1],
      FAILING[0][1],
      OK_LINES[2],
    ]);
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });

  it("hace un número fijo de consultas sea cual sea N", async () => {
    const one = setup();
    await one.service.priceLines(OK_LINES);
    const many = setup();
    await many.service.priceLines(
      Array.from({ length: 10 }, () => OK_LINES).flat(),
    );

    expect(one.queryCount()).toBe(6);
    expect(many.queryCount()).toBe(6);
    expect(many.repos.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-1", "p-2"] } },
    });
  });

  it("sin líneas no consulta nada", async () => {
    const { service, queryCount } = setup();
    await expect(service.priceLines([])).resolves.toEqual([]);
    expect(queryCount()).toBe(0);
  });

  it("priceOrderLines deja las líneas listas para la orden", async () => {
    const items = await setup().service.priceOrderLines([OK_LINES[2]]);
    expect(items).toEqual([
      {
        productId: "p-1",
        productSizeId: undefined,
        comboId: "c-1",
        quantity: 3,
        unitPrice: 30,
        subtotal: 90,
        modifiers: [],
      },
    ]);
  });
});
