import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CATALOG_MAX_RECOMMENDATIONS,
  GetCatalogItemUseCase,
} from "./get-catalog-item.use-case";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import type { ISectionRepository } from "../../../domain/repositories/section.repository.interface";
import { ProductEntity } from "../../../domain/entities/product.entity";
import { ComboEntity } from "../../../domain/entities/combo.entity";
import { SectionEntity } from "../../../domain/entities/section.entity";
import { Lang } from "../../../domain/enums/lang.enum";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";

// 2026-10-15 12:00 en Caracas. Corte de "Nuevos": 2026-09-15 00:00 Caracas.
const NOW = new Date("2026-10-15T16:00:00.000Z");
const RECENT = new Date("2026-10-01T12:00:00.000Z");
const OLD = new Date("2026-01-10T12:00:00.000Z");

type ProductRow = Prisma.ProductGetPayload<object>;
type IngredientRow = Prisma.IngredientGetPayload<object>;
type TagRow = Prisma.TagGetPayload<object>;

const NO_NUTRITION = {
  energyKj: null,
  calories: null,
  fat: null,
  saturatedFat: null,
  carbohydrates: null,
  sugar: null,
  fiber: null,
  cholesterolMg: null,
  sodiumMg: null,
};

const TAG_SALUDABLE: TagRow = {
  id: "tag-saludable",
  nameEs: "Saludable",
  nameEn: "Healthy",
  isActive: true,
  createdAt: OLD,
  updatedAt: OLD,
};

function ingredient(
  id: string,
  nameEs: string,
  overrides: Partial<IngredientRow> = {},
): IngredientRow {
  return {
    id,
    nameEs,
    nameEn: null,
    image: null,
    isActive: true,
    createdAt: OLD,
    updatedAt: OLD,
    ...overrides,
  };
}

const CEBOLLA = ingredient("ing-cebolla", "Cebolla", {
  nameEn: "Onion",
  image: "https://cdn/cebolla.png",
});
const QUESO = ingredient("ing-queso", "Queso");
const HARINA = ingredient("ing-harina", "Harina");
const INACTIVO = ingredient("ing-inactivo", "Retirado", { isActive: false });

interface ProductFixture {
  isActive?: boolean;
  isFeatured?: boolean;
  createdAt?: Date;
  image?: string | null;
  basePrice?: number;
  nutrition?: Partial<
    Record<keyof typeof NO_NUTRITION, number | Prisma.Decimal | null>
  >;
  sizes?: {
    nameEs: string;
    nameEn?: string | null;
    price: number;
    sortOrder: number;
    servings?: number | null;
    isDefault?: boolean;
    isActive?: boolean;
  }[];
  images?: { url: string; sortOrder: number }[];
  ingredients?: { ingredient: IngredientRow; sortOrder: number }[];
  tags?: TagRow[];
}

function productRow(id: string, f: ProductFixture = {}): ProductRow {
  return {
    id,
    nameEs: `Producto ${id}`,
    nameEn: null,
    descriptionEs: `Descripción ${id}`,
    descriptionEn: null,
    basePrice: new Prisma.Decimal(f.basePrice ?? 10),
    image: f.image === undefined ? `https://cdn/${id}.png` : f.image,
    stock: null,
    isActive: f.isActive ?? true,
    isFeatured: f.isFeatured ?? false,
    isOnSale: false,
    ...NO_NUTRITION,
    ...(f.nutrition as Partial<ProductRow>),
    createdAt: f.createdAt ?? OLD,
    updatedAt: OLD,
  };
}

function product(id: string, f: ProductFixture = {}): ProductEntity {
  return ProductEntity.fromPrisma({
    ...productRow(id, f),
    sizes: (f.sizes ?? []).map((size, index) => ({
      id: `${id}-size-${index}`,
      productId: id,
      nameEs: size.nameEs,
      nameEn: size.nameEn ?? null,
      descriptionEs: null,
      descriptionEn: null,
      price: new Prisma.Decimal(size.price),
      stock: null,
      sortOrder: size.sortOrder,
      isDefault: size.isDefault ?? false,
      isActive: size.isActive ?? true,
      servings: size.servings ?? null,
    })),
    tags: (f.tags ?? []).map((tag) => ({ tag })),
    images: (f.images ?? []).map((image, index) => ({
      id: `${id}-img-${index}`,
      productId: id,
      url: image.url,
      sortOrder: image.sortOrder,
      createdAt: OLD,
    })),
    ingredients: (f.ingredients ?? []).map((pi) => ({
      productId: id,
      ingredientId: pi.ingredient.id,
      sortOrder: pi.sortOrder,
      ingredient: pi.ingredient,
    })),
  });
}

function combo(
  id: string,
  f: {
    isActive?: boolean;
    isFeatured?: boolean;
    price?: number;
    image?: string | null;
    items?: { product: ProductRow; quantity: number }[];
  } = {},
): ComboEntity {
  return ComboEntity.fromPrisma({
    id,
    nameEs: `Combo ${id}`,
    nameEn: null,
    descriptionEs: null,
    descriptionEn: null,
    price: new Prisma.Decimal(f.price ?? 50),
    image: f.image === undefined ? `https://cdn/${id}.png` : f.image,
    isActive: f.isActive ?? true,
    isFeatured: f.isFeatured ?? false,
    isOnSale: false,
    createdAt: OLD,
    updatedAt: OLD,
    items: (f.items ?? []).map((item, index) => ({
      id: `${id}-item-${index}`,
      comboId: id,
      productId: item.product.id,
      quantity: item.quantity,
      sortOrder: index,
      product: item.product,
    })),
  });
}

function section(
  id: string,
  order: number,
  items: { productId?: string; comboId?: string; order: number }[],
): SectionEntity {
  return SectionEntity.fromPrisma({
    id,
    nameEs: `Sección ${id}`,
    nameEn: null,
    slug: id,
    order,
    isActive: true,
    createdAt: OLD,
    updatedAt: OLD,
    items: items.map((item, index) => ({
      id: `${id}-item-${index}`,
      sectionId: id,
      productId: item.productId ?? null,
      comboId: item.comboId ?? null,
      order: item.order,
    })),
  });
}

/** Simula el `where` que usa el use-case: id, id.in, isActive e isFeatured. */
function applyWhere<T extends { id?: string; isActive: boolean }>(
  rows: T[],
  where: Record<string, unknown> | undefined,
  isFeatured: (row: T) => boolean,
): T[] {
  return rows.filter((row) => {
    if (!where) return true;
    const idFilter = where.id as string | { in: string[] } | undefined;
    if (typeof idFilter === "string" && row.id !== idFilter) return false;
    if (
      idFilter &&
      typeof idFilter === "object" &&
      !idFilter.in.includes(row.id!)
    ) {
      return false;
    }
    if (where.isActive === true && !row.isActive) return false;
    if (where.isFeatured === true && !isFeatured(row)) return false;
    return true;
  });
}

function setup(data: {
  products?: ProductEntity[];
  combos?: ComboEntity[];
  sections?: SectionEntity[];
  requiredModifiers?: boolean;
}) {
  const products = data.products ?? [];
  const combos = data.combos ?? [];
  const productRepository = {
    findUnique: jest.fn((args: Prisma.ProductFindUniqueArgs) =>
      Promise.resolve(products.find((p) => p.id === args.where.id) ?? null),
    ),
    findMany: jest.fn((args: Prisma.ProductFindManyArgs) =>
      Promise.resolve({
        data: applyWhere(
          products,
          args.where as Record<string, unknown>,
          (p) => p.isFeatured,
        ),
      }),
    ),
    exists: jest.fn(() => Promise.resolve(data.requiredModifiers ?? false)),
  };
  const comboRepository = {
    findUnique: jest.fn((args: Prisma.ComboFindUniqueArgs) =>
      Promise.resolve(combos.find((c) => c.id === args.where.id) ?? null),
    ),
    findMany: jest.fn((args: Prisma.ComboFindManyArgs) =>
      Promise.resolve({
        data: applyWhere(
          combos,
          args.where as Record<string, unknown>,
          (c) => c.isFeatured,
        ),
      }),
    ),
  };
  const sectionRepository = {
    findMany: jest.fn((args: Prisma.SectionFindManyArgs) => {
      const some = (args.where?.items as { some: Record<string, string> }).some;
      return Promise.resolve({
        data: (data.sections ?? []).filter((s) =>
          (s.items ?? []).some((item) =>
            some.productId
              ? item.productId === some.productId
              : item.comboId === some.comboId,
          ),
        ),
      });
    }),
  };
  const useCase = new GetCatalogItemUseCase(
    sectionRepository as unknown as ISectionRepository,
    productRepository as unknown as IProductRepository,
    comboRepository as unknown as IComboRepository,
    new CatalogCacheService(),
  );
  return { useCase, productRepository, comboRepository, sectionRepository };
}

describe("GetCatalogItemUseCase", () => {
  describe("producto", () => {
    const pasapalos = product("p-pasapalos", {
      isFeatured: true,
      createdAt: RECENT,
      image: "https://cdn/principal.png",
      tags: [TAG_SALUDABLE],
      nutrition: {
        energyKj: 3138,
        calories: 750,
        fat: new Prisma.Decimal("31.5"),
        saturatedFat: new Prisma.Decimal(12),
        carbohydrates: new Prisma.Decimal(93),
        sugar: null,
        fiber: new Prisma.Decimal("12.0"),
        cholesterolMg: 50,
        sodiumMg: 610,
      },
      sizes: [
        { nameEs: "15 personas", price: 60, sortOrder: 2, servings: 15 },
        {
          nameEs: "8 personas",
          nameEn: "8 people",
          price: 34,
          sortOrder: 1,
          servings: 8,
          isDefault: true,
        },
        { nameEs: "Retirado", price: 99, sortOrder: 0, isActive: false },
        { nameEs: "Para 2", price: 12.5, sortOrder: 0 },
      ],
      images: [
        { url: "https://cdn/galeria-2.png", sortOrder: 2 },
        { url: "https://cdn/principal.png", sortOrder: 0 },
        { url: "https://cdn/galeria-1.png", sortOrder: 1 },
      ],
      ingredients: [
        { ingredient: QUESO, sortOrder: 2 },
        { ingredient: CEBOLLA, sortOrder: 1 },
        { ingredient: INACTIVO, sortOrder: 0 },
      ],
    });

    it("arma la ficha con galería, tamaños, ingredientes y nutrición", async () => {
      const { useCase } = setup({ products: [pasapalos] });

      const result = await useCase.execute("product", "p-pasapalos", Lang.ES, {
        now: NOW,
      });

      expect(result).toMatchObject({
        id: "p-pasapalos",
        kind: "product",
        name: "Producto p-pasapalos",
        description: "Descripción p-pasapalos",
        isFeatured: true,
        isOnSale: false,
        isNew: true,
        tags: [{ id: "tag-saludable", name: "Saludable" }],
        price: null,
        comboItems: [],
        hasRequiredModifiers: false,
      });
      // Principal primero, galería por sortOrder, sin duplicar la principal.
      expect(result.images).toEqual([
        "https://cdn/principal.png",
        "https://cdn/galeria-1.png",
        "https://cdn/galeria-2.png",
      ]);
      // Solo activos, por sortOrder; label = nombre del tamaño.
      expect(result.servingOptions).toEqual([
        {
          sizeId: "p-pasapalos-size-3",
          label: "Para 2",
          servings: null,
          price: "12.50",
          isDefault: false,
        },
        {
          sizeId: "p-pasapalos-size-1",
          label: "8 personas",
          servings: 8,
          price: "34.00",
          isDefault: true,
        },
        {
          sizeId: "p-pasapalos-size-0",
          label: "15 personas",
          servings: 15,
          price: "60.00",
          isDefault: false,
        },
      ]);
      expect(result.ingredients).toEqual([
        {
          id: "ing-cebolla",
          name: "Cebolla",
          image: "https://cdn/cebolla.png",
        },
        { id: "ing-queso", name: "Queso", image: null },
      ]);
      expect(result.nutrition).toEqual({
        energyKj: 3138,
        calories: 750,
        fat: 31.5,
        saturatedFat: 12,
        carbohydrates: 93,
        sugar: null,
        fiber: 12,
        cholesterolMg: 50,
        sodiumMg: 610,
      });
    });

    it("carga solo ingredientes activos y tamaños activos en una consulta", async () => {
      const { useCase, productRepository } = setup({ products: [pasapalos] });

      await useCase.execute("product", "p-pasapalos");

      expect(productRepository.findUnique).toHaveBeenCalledWith({
        where: { id: "p-pasapalos" },
        include: expect.objectContaining({
          sizes: expect.objectContaining({
            where: { isActive: true },
          }) as unknown,
          images: { orderBy: { sortOrder: "asc" } },
          ingredients: expect.objectContaining({
            where: { ingredient: { isActive: true } },
          }) as unknown,
        }) as unknown,
      });
    });

    it("las recomendaciones consultan solo ítems activos", async () => {
      const { useCase, productRepository, comboRepository } = setup({
        products: [product("p-actual")],
      });

      await useCase.execute("product", "p-actual");

      // Sin secciones: cae a destacados activos.
      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFeatured: true, isActive: true },
        }),
      );
      expect(comboRepository.findMany).toHaveBeenCalledWith({
        where: { isFeatured: true, isActive: true },
      });
    });

    it("usa el inglés con caída al español", async () => {
      const { useCase } = setup({ products: [pasapalos] });

      const result = await useCase.execute("product", "p-pasapalos", Lang.EN, {
        now: NOW,
      });

      expect(result.tags).toEqual([{ id: "tag-saludable", name: "Healthy" }]);
      expect(result.servingOptions.map((o) => o.label)).toEqual([
        "Para 2",
        "8 people",
        "15 personas",
      ]);
      expect(result.ingredients.map((i) => i.name)).toEqual(["Onion", "Queso"]);
    });

    it("devuelve nutrition null si no hay ningún dato cargado", async () => {
      const { useCase } = setup({ products: [product("p-simple")] });

      const result = await useCase.execute("product", "p-simple", Lang.ES, {
        now: NOW,
      });

      expect(result.nutrition).toBeNull();
      expect(result.servingOptions).toEqual([]);
      // Sin tamaños activos: price = basePrice (lo que cobra el carrito).
      expect(result.price).toBe("10.00");
      expect(result.ingredients).toEqual([]);
      expect(result.images).toEqual(["https://cdn/p-simple.png"]);
      expect(result.isNew).toBe(false);
    });

    it("con solo tamaños inactivos devuelve price = basePrice", async () => {
      const { useCase } = setup({
        products: [
          product("p-tamano-retirado", {
            basePrice: 7.5,
            sizes: [
              { nameEs: "Retirado", price: 20, sortOrder: 0, isActive: false },
            ],
          }),
        ],
      });

      const result = await useCase.execute("product", "p-tamano-retirado");

      expect(result.servingOptions).toEqual([]);
      expect(result.price).toBe("7.50");
    });

    it("sin imagen principal ni galería devuelve images vacío", async () => {
      const { useCase } = setup({
        products: [product("p-sin-foto", { image: null })],
      });

      const result = await useCase.execute("product", "p-sin-foto");

      expect(result.images).toEqual([]);
    });

    it("hasRequiredModifiers: grupo con minSelect > 0 y algún modificador activo", async () => {
      const { useCase, productRepository } = setup({
        products: [pasapalos],
        requiredModifiers: true,
      });

      const result = await useCase.execute("product", "p-pasapalos");

      expect(result.hasRequiredModifiers).toBe(true);
      expect(productRepository.exists).toHaveBeenCalledWith({
        where: {
          id: "p-pasapalos",
          modifierGroups: {
            some: {
              minSelect: { gt: 0 },
              modifiers: { some: { isActive: true } },
            },
          },
        },
      });
    });

    it("lanza 404 si el producto no existe o está inactivo", async () => {
      const { useCase } = setup({
        products: [product("p-inactivo", { isActive: false })],
      });

      await expect(useCase.execute("product", "p-inactivo")).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute("product", "p-nada")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("combo", () => {
    const tequenoRow = productRow("p-tequeno", {
      image: "https://cdn/tequeno.png",
    });
    const empanadaRow = productRow("p-empanada", {
      image: "https://cdn/combo-desayuno.png",
    });
    const tequeno = product("p-tequeno", {
      image: "https://cdn/tequeno.png",
      images: [{ url: "https://cdn/tequeno-2.png", sortOrder: 0 }],
      ingredients: [
        { ingredient: HARINA, sortOrder: 0 },
        { ingredient: QUESO, sortOrder: 1 },
      ],
    });
    const empanada = product("p-empanada", {
      // Misma URL que la del combo: no se duplica.
      image: "https://cdn/combo-desayuno.png",
      ingredients: [
        { ingredient: QUESO, sortOrder: 0 },
        { ingredient: CEBOLLA, sortOrder: 1 },
      ],
      nutrition: { calories: 400 },
    });
    const desayuno = combo("c-desayuno", {
      price: 45,
      image: "https://cdn/combo-desayuno.png",
      items: [
        { product: tequenoRow, quantity: 2 },
        { product: empanadaRow, quantity: 1 },
      ],
    });

    it("une imágenes e ingredientes de sus productos sin duplicados", async () => {
      const { useCase, productRepository } = setup({
        products: [tequeno, empanada],
        combos: [desayuno],
      });

      const result = await useCase.execute("combo", "c-desayuno", Lang.ES, {
        now: NOW,
      });

      expect(result).toMatchObject({
        id: "c-desayuno",
        kind: "combo",
        name: "Combo c-desayuno",
        price: "45.00",
        servingOptions: [],
        tags: [],
        nutrition: null,
        hasRequiredModifiers: false,
      });
      expect(result.comboItems).toEqual([
        { productId: "p-tequeno", name: "Producto p-tequeno", quantity: 2 },
        { productId: "p-empanada", name: "Producto p-empanada", quantity: 1 },
      ]);
      expect(result.images).toEqual([
        "https://cdn/combo-desayuno.png",
        "https://cdn/tequeno.png",
        "https://cdn/tequeno-2.png",
      ]);
      expect(result.ingredients.map((i) => i.id)).toEqual([
        "ing-harina",
        "ing-queso",
        "ing-cebolla",
      ]);
      // Productos del combo en una sola consulta (sin N+1).
      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["p-tequeno", "p-empanada"] }, isActive: true },
        }),
      );
      expect(productRepository.findUnique).not.toHaveBeenCalled();
    });

    it("ignora productos inactivos en imágenes e ingredientes, pero los lista en comboItems", async () => {
      const retiradoRow = productRow("p-retirado", { isActive: false });
      const retirado = product("p-retirado", {
        isActive: false,
        images: [{ url: "https://cdn/retirado-2.png", sortOrder: 0 }],
        ingredients: [{ ingredient: HARINA, sortOrder: 0 }],
      });
      const { useCase } = setup({
        products: [empanada, retirado],
        combos: [
          combo("c-mixto", {
            image: null,
            items: [
              { product: retiradoRow, quantity: 1 },
              { product: empanadaRow, quantity: 3 },
            ],
          }),
        ],
      });

      const result = await useCase.execute("combo", "c-mixto");

      expect(result.comboItems.map((i) => i.productId)).toEqual([
        "p-retirado",
        "p-empanada",
      ]);
      expect(result.images).toEqual(["https://cdn/combo-desayuno.png"]);
      expect(result.ingredients.map((i) => i.id)).toEqual([
        "ing-queso",
        "ing-cebolla",
      ]);
    });

    it("un combo sin ítems no consulta productos y devuelve listas vacías", async () => {
      const { useCase, productRepository } = setup({
        combos: [combo("c-vacio", { image: null })],
      });

      const result = await useCase.execute("combo", "c-vacio");

      expect(result.comboItems).toEqual([]);
      expect(result.images).toEqual([]);
      expect(result.ingredients).toEqual([]);
      expect(result.price).toBe("50.00");
      // Solo las consultas de recomendaciones (destacados), no la de productos del combo.
      expect(productRepository.findMany).toHaveBeenCalledTimes(1);
    });

    it("lanza 404 si el combo no existe o está inactivo", async () => {
      const { useCase } = setup({
        combos: [combo("c-inactivo", { isActive: false })],
      });

      await expect(useCase.execute("combo", "c-inactivo")).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute("combo", "c-nada")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("recomendaciones", () => {
    it("toma ítems activos de las mismas secciones, en orden y sin el propio ítem", async () => {
      const products = [
        product("p-actual"),
        product("p-a"),
        product("p-b"),
        product("p-inactivo", { isActive: false }),
        product("p-otra-seccion"),
      ];
      const combos = [combo("c-a", { price: 30 })];
      const sections = [
        section("s-2", 2, [
          { productId: "p-b", order: 0 },
          { productId: "p-actual", order: 1 },
          { productId: "p-a", order: 2 }, // repetido: ya salió en s-1
        ]),
        section("s-1", 1, [
          { productId: "p-actual", order: 0 },
          { productId: "p-inactivo", order: 1 },
          { comboId: "c-a", order: 3 },
          { productId: "p-a", order: 2 },
        ]),
        section("s-ajena", 0, [{ productId: "p-otra-seccion", order: 0 }]),
      ];
      // El repo devuelve las secciones ya ordenadas por `order`.
      sections.sort((a, b) => a.order - b.order);
      const { useCase } = setup({ products, combos, sections });

      const result = await useCase.execute("product", "p-actual", Lang.ES, {
        now: NOW,
      });

      expect(result.recommendations.map((r) => `${r.kind}:${r.id}`)).toEqual([
        "product:p-a",
        "combo:c-a",
        "product:p-b",
      ]);
      // Misma forma que una tarjeta de GET /catalog.
      expect(result.recommendations[1]).toEqual({
        id: "c-a",
        kind: "combo",
        name: "Combo c-a",
        description: null,
        image: "https://cdn/c-a.png",
        priceFrom: "30.00",
        priceTo: "30.00",
        tags: [],
        isNew: false,
        isFeatured: false,
        isOnSale: false,
      });
    });

    it("limita a 8 recomendaciones", async () => {
      const others = Array.from({ length: 12 }, (_, i) =>
        product(`p-${String(i).padStart(2, "0")}`),
      );
      const { useCase } = setup({
        products: [product("p-actual"), ...others],
        sections: [
          section("s-1", 1, [
            { productId: "p-actual", order: 0 },
            ...others.map((p, i) => ({ productId: p.id, order: i + 1 })),
          ]),
        ],
      });

      const result = await useCase.execute("product", "p-actual");

      expect(result.recommendations).toHaveLength(CATALOG_MAX_RECOMMENDATIONS);
      expect(result.recommendations[0].id).toBe("p-00");
    });

    it("sin secciones usa los destacados (sin el propio ítem)", async () => {
      const { useCase } = setup({
        products: [
          product("p-actual", { isFeatured: true }),
          product("p-destacado", { isFeatured: true }),
          product("p-normal"),
          product("p-destacado-inactivo", {
            isFeatured: true,
            isActive: false,
          }),
        ],
        combos: [combo("c-destacado", { isFeatured: true })],
      });

      const result = await useCase.execute("product", "p-actual");

      expect(result.recommendations.map((r) => r.id)).toEqual([
        "c-destacado",
        "p-destacado",
      ]);
    });

    it("si las secciones solo tienen ítems inactivos, cae a destacados", async () => {
      const { useCase } = setup({
        products: [
          product("p-actual"),
          product("p-inactivo", { isActive: false }),
          product("p-destacado", { isFeatured: true }),
        ],
        sections: [
          section("s-1", 1, [
            { productId: "p-actual", order: 0 },
            { productId: "p-inactivo", order: 1 },
          ]),
        ],
      });

      const result = await useCase.execute("product", "p-actual");

      expect(result.recommendations.map((r) => r.id)).toEqual(["p-destacado"]);
    });

    it("en un combo busca secciones por comboId y excluye el combo", async () => {
      const { useCase, sectionRepository } = setup({
        products: [product("p-a")],
        combos: [combo("c-actual", { isFeatured: true })],
        sections: [
          section("s-1", 1, [
            { comboId: "c-actual", order: 0 },
            { productId: "p-a", order: 1 },
          ]),
        ],
      });

      const result = await useCase.execute("combo", "c-actual");

      expect(result.recommendations.map((r) => r.id)).toEqual(["p-a"]);
      expect(sectionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, items: { some: { comboId: "c-actual" } } },
        }),
      );
    });
  });

  describe("caché", () => {
    it('sirve la ficha cacheada y la recarga si cambia el idioma o el día de "Nuevos"', async () => {
      const { useCase, productRepository } = setup({
        products: [product("p-actual")],
      });
      const loads = () => productRepository.findUnique.mock.calls.length;

      await useCase.execute("product", "p-actual", Lang.ES, { now: NOW });
      await useCase.execute("product", "p-actual", Lang.ES, { now: NOW });
      expect(loads()).toBe(1);

      await useCase.execute("product", "p-actual", Lang.EN, { now: NOW });
      expect(loads()).toBe(2);

      const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      await useCase.execute("product", "p-actual", Lang.ES, { now: nextDay });
      expect(loads()).toBe(3);
    });

    it("no cachea el 404", async () => {
      const { useCase, productRepository } = setup({});

      await expect(useCase.execute("product", "p-nada")).rejects.toThrow();
      await expect(useCase.execute("product", "p-nada")).rejects.toThrow();
      expect(productRepository.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
