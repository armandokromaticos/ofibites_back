import { CartEntity, findMatchingCartItem } from "./cart.entity";
import { CartViewService } from "../../application/services/cart-view.service";
import type { ICartRepository } from "../repositories/cart.repository.interface";
import type { LineItemPricingService } from "../../application/services/line-item-pricing.service";
import { Lang } from "../enums/lang.enum";

const NOW = new Date("2026-10-16T12:00:00.000Z");

function product(overrides: Record<string, unknown> = {}) {
  return {
    nameEs: "Wrap de pollo",
    nameEn: "Chicken wrap",
    image: "https://cdn/wrap.png",
    isActive: true,
    sizes: [] as { id: string }[],
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    cartId: "cart-1",
    productId: "p-1",
    productSizeId: null as string | null,
    comboId: null as string | null,
    addedById: "user-1",
    quantity: 2,
    createdAt: NOW,
    modifiers: [] as {
      id: string;
      cartItemId: string;
      modifierId: string;
      modifier?: Record<string, unknown>;
    }[],
    product: product(),
    productSize: null as unknown,
    combo: null as unknown,
    ...overrides,
  };
}

function cartWith(items: ReturnType<typeof item>[]) {
  return CartEntity.fromPrisma({
    id: "cart-1",
    companyId: "company-1",
    createdAt: NOW,
    updatedAt: NOW,
    items: items as never,
  });
}

const size = {
  productId: "p-1",
  nameEs: "Bandeja grande",
  nameEn: null,
  servings: 12,
  isActive: true,
};

const combo = {
  nameEs: "Combo desayuno",
  nameEn: "Breakfast combo",
  image: "https://cdn/combo.png",
  isActive: true,
  items: [{ productId: "p-1" }],
};

describe("CartEntity · datos de presentación y disponibilidad", () => {
  it("producto sin tamaños: nombre, imagen y disponible", () => {
    const [line] = cartWith([item()]).items;
    expect(line.display).toEqual({
      nameEs: "Wrap de pollo",
      nameEn: "Chicken wrap",
      image: "https://cdn/wrap.png",
      sizeNameEs: null,
      sizeNameEn: null,
      servings: null,
      isAvailable: true,
    });
  });

  it("con tamaño: nombre del tamaño y personas", () => {
    const [line] = cartWith([
      item({
        productSizeId: "s-1",
        productSize: size,
        product: product({ sizes: [{ id: "s-1" }] }),
      }),
    ]).items;
    expect(line.display).toMatchObject({
      sizeNameEs: "Bandeja grande",
      servings: 12,
      isAvailable: true,
    });
  });

  it("combo: nombre e imagen del combo", () => {
    const [line] = cartWith([item({ comboId: "c-1", combo })]).items;
    expect(line.display).toMatchObject({
      nameEs: "Combo desayuno",
      image: "https://cdn/combo.png",
      isAvailable: true,
    });
  });

  it.each([
    ["producto inactivo", item({ product: product({ isActive: false }) })],
    [
      "tamaño inactivo",
      item({ productSizeId: "s-1", productSize: { ...size, isActive: false } }),
    ],
    [
      "tamaño de otro producto",
      item({
        productSizeId: "s-1",
        productSize: { ...size, productId: "p-9" },
      }),
    ],
    [
      "sin tamaño pero el producto ahora tiene tamaños",
      item({ product: product({ sizes: [{ id: "s-1" }] }) }),
    ],
    [
      "modificador inactivo",
      item({
        modifiers: [
          {
            id: "m",
            cartItemId: "item-1",
            modifierId: "mod-1",
            modifier: { isActive: false },
          },
        ],
      }),
    ],
    [
      "combo inactivo",
      item({ comboId: "c-1", combo: { ...combo, isActive: false } }),
    ],
    [
      "producto fuera del combo",
      item({
        comboId: "c-1",
        combo: { ...combo, items: [{ productId: "p-9" }] },
      }),
    ],
  ])("no disponible: %s, pero conserva el nombre", (_caso, row) => {
    const [line] = cartWith([row]).items;
    expect(line.display?.isAvailable).toBe(false);
    expect(line.display?.nameEs).toBeTruthy();
  });

  it.each([
    [
      "modificador de otro producto",
      { isActive: true, group: { productId: "p-9" } },
      null,
      false,
    ],
    [
      "modificador del producto",
      { isActive: true, group: { productId: "p-1" } },
      null,
      true,
    ],
    [
      "sizeRestricted sin precio para el tamaño",
      {
        isActive: true,
        sizeRestricted: true,
        sizePrices: [{ productSizeId: "s-2" }],
      },
      "s-1",
      false,
    ],
    [
      "sizeRestricted con precio para el tamaño",
      {
        isActive: true,
        sizeRestricted: true,
        sizePrices: [{ productSizeId: "s-1" }],
      },
      "s-1",
      true,
    ],
  ])("isCartItemAvailable · %s", (_caso, modifier, sizeId, expected) => {
    const [line] = cartWith([
      item({
        productSizeId: sizeId,
        productSize: sizeId ? size : null,
        product: product({ sizes: sizeId ? [{ id: sizeId }] : [] }),
        modifiers: [
          { id: "x", cartItemId: "item-1", modifierId: "mod-1", modifier },
        ],
      }),
    ]).items;
    expect(line.display?.isAvailable).toBe(expected);
  });

  it("combo con producto ancla inactivo sigue disponible (se rige por el combo)", () => {
    const [line] = cartWith([
      item({
        comboId: "c-1",
        combo,
        product: product({ isActive: false }),
      }),
    ]).items;
    expect(line.display?.isAvailable).toBe(true);
  });

  it("findMatchingCartItem ignora el orden de los modificadores", () => {
    const items = [
      {
        productId: "p-1",
        productSizeId: "s-1",
        comboId: null,
        modifierIds: ["b", "a"],
      },
    ];
    expect(
      findMatchingCartItem(items, {
        productId: "p-1",
        productSizeId: "s-1",
        modifierIds: ["a", "b"],
      }),
    ).toBe(items[0]);
    expect(
      findMatchingCartItem(items, {
        productId: "p-1",
        productSizeId: "s-1",
        modifierIds: ["a"],
      }),
    ).toBeUndefined();
  });
});

describe("CartViewService · ítems enriquecidos", () => {
  function view(cart: CartEntity) {
    const repo = {
      getOrCreateViewByCompanyId: jest.fn(() => Promise.resolve(cart)),
    };
    const pricing = {
      priceLineItem: jest.fn(() =>
        Promise.resolve({ unitPrice: 10, subtotal: 20, modifiers: [] }),
      ),
    };
    return new CartViewService(
      repo as unknown as ICartRepository,
      pricing as unknown as LineItemPricingService,
    );
  }

  it("devuelve name, image, sizeLabel, servings e isAvailable en el idioma pedido", async () => {
    const cart = cartWith([
      item({
        productSizeId: "s-1",
        productSize: { ...size, nameEn: "Large tray" },
        product: product({ sizes: [{ id: "s-1" }] }),
      }),
      item({
        id: "item-2",
        comboId: "c-1",
        combo: { ...combo, isActive: false },
      }),
    ]);

    const es = await view(cart).build("company-1");
    expect(es.items[0]).toMatchObject({
      name: "Wrap de pollo",
      image: "https://cdn/wrap.png",
      sizeLabel: "Bandeja grande",
      servings: 12,
      isAvailable: true,
      unitPrice: 10,
    });
    expect(es.items[1]).toMatchObject({
      name: "Combo desayuno",
      sizeLabel: null,
      servings: null,
      isAvailable: false,
    });

    const en = await view(cart).build("company-1", Lang.EN);
    expect(en.items[0]).toMatchObject({
      name: "Chicken wrap",
      sizeLabel: "Large tray",
    });
  });

  it("en inglés cae al español si falta la traducción", async () => {
    const cart = cartWith([
      item({
        product: product({ nameEn: null }),
        productSizeId: "s-1",
        productSize: size,
      }),
    ]);
    const en = await view(cart).build("company-1", Lang.EN);
    expect(en.items[0]).toMatchObject({
      name: "Wrap de pollo",
      sizeLabel: "Bandeja grande",
    });
  });
});
