import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GetCatalogUseCase } from "./get-catalog.use-case";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import type { ISectionRepository } from "../../../domain/repositories/section.repository.interface";
import { ProductEntity } from "../../../domain/entities/product.entity";
import { ComboEntity } from "../../../domain/entities/combo.entity";
import { SectionEntity } from "../../../domain/entities/section.entity";
import { CatalogFilter } from "../../../domain/enums/catalog-filter.enum";
import { Lang } from "../../../domain/enums/lang.enum";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";

// 2026-10-15 12:00 en Caracas (UTC-4). Corte de "Nuevos": 2026-09-15 00:00 Caracas.
const NOW = new Date("2026-10-15T16:00:00.000Z");
const NEW_SINCE = new Date("2026-09-15T04:00:00.000Z");
const OLD = new Date("2026-01-10T12:00:00.000Z");

type TagRow = Prisma.TagGetPayload<object>;

const TAG_KETO: TagRow = {
  id: "11111111-1111-4111-8111-111111111111",
  nameEs: "Keto",
  nameEn: null,
  isActive: true,
  createdAt: OLD,
  updatedAt: OLD,
};
const TAG_SALUDABLE: TagRow = {
  id: "22222222-2222-4222-8222-222222222222",
  nameEs: "Saludable",
  nameEn: "Healthy",
  isActive: true,
  createdAt: OLD,
  updatedAt: OLD,
};

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

function product(
  id: string,
  overrides: Partial<{
    nameEs: string;
    nameEn: string | null;
    descriptionEs: string | null;
    basePrice: number;
    isFeatured: boolean;
    isOnSale: boolean;
    createdAt: Date;
    sizes: { price: number; isActive?: boolean }[];
    tags: TagRow[];
  }> = {},
): ProductEntity {
  return ProductEntity.fromPrisma({
    id,
    nameEs: overrides.nameEs ?? `Producto ${id}`,
    nameEn: overrides.nameEn ?? null,
    descriptionEs: overrides.descriptionEs ?? null,
    descriptionEn: null,
    basePrice: new Prisma.Decimal(overrides.basePrice ?? 10),
    image: null,
    stock: null,
    isActive: true,
    isFeatured: overrides.isFeatured ?? false,
    isOnSale: overrides.isOnSale ?? false,
    ...NO_NUTRITION,
    createdAt: overrides.createdAt ?? OLD,
    updatedAt: OLD,
    sizes: (overrides.sizes ?? []).map((size, index) => ({
      id: `${id}-size-${index}`,
      productId: id,
      nameEs: `Tamaño ${index}`,
      nameEn: null,
      descriptionEs: null,
      descriptionEn: null,
      price: new Prisma.Decimal(size.price),
      stock: null,
      sortOrder: index,
      isDefault: index === 0,
      isActive: size.isActive ?? true,
      servings: null,
    })),
    tags: (overrides.tags ?? []).map((tag) => ({ tag })),
  });
}

function combo(
  id: string,
  overrides: Partial<{ nameEs: string; price: number; isOnSale: boolean }> = {},
): ComboEntity {
  return ComboEntity.fromPrisma({
    id,
    nameEs: overrides.nameEs ?? `Combo ${id}`,
    nameEn: null,
    descriptionEs: null,
    descriptionEn: null,
    price: new Prisma.Decimal(overrides.price ?? 50),
    image: null,
    isActive: true,
    isFeatured: false,
    isOnSale: overrides.isOnSale ?? false,
    createdAt: OLD,
    updatedAt: OLD,
  });
}

function section(
  id: string,
  slug: string,
  order: number,
  items: { productId?: string; comboId?: string; order: number }[],
): SectionEntity {
  return SectionEntity.fromPrisma({
    id,
    nameEs: `Sección ${slug}`,
    nameEn: null,
    slug,
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

describe("GetCatalogUseCase", () => {
  const products = [
    product("p-agua", { nameEs: "Agua mineral", basePrice: 2 }),
    product("p-cafe", {
      nameEs: "Café americano",
      nameEn: "American coffee",
      descriptionEs: "Tueste medio",
      isFeatured: true,
      sizes: [{ price: 3.5 }, { price: 6 }, { price: 99, isActive: false }],
      tags: [TAG_KETO, TAG_SALUDABLE],
    }),
    product("p-bowl", {
      nameEs: "Bowl de quinoa",
      isOnSale: true,
      createdAt: NEW_SINCE,
      tags: [TAG_SALUDABLE],
    }),
    product("p-tarta", {
      nameEs: "Tarta de piña",
      createdAt: new Date(NEW_SINCE.getTime() - 1),
    }),
  ];
  const combos = [combo("c-am", { nameEs: "Surtido AM", price: 120 })];
  const sections = [
    section("s-bebidas", "bebidas", 2, [
      { productId: "p-agua", order: 2 },
      { productId: "p-cafe", order: 1 },
      { productId: "p-inactivo", order: 0 },
    ]),
    section("s-cb", "coffee-break", 1, [
      { comboId: "c-am", order: 0 },
      { productId: "p-cafe", order: 1 },
    ]),
  ];

  const sectionRepository = {
    findMany: jest.fn().mockResolvedValue({ data: sections }),
  } as unknown as ISectionRepository;
  const productRepository = {
    findMany: jest.fn().mockResolvedValue({ data: products }),
  } as unknown as IProductRepository;
  const comboRepository = {
    findMany: jest.fn().mockResolvedValue({ data: combos }),
  } as unknown as IComboRepository;

  const useCase = new GetCatalogUseCase(
    sectionRepository,
    productRepository,
    comboRepository,
    new CatalogCacheService(),
  );
  const run = (query: Parameters<GetCatalogUseCase["execute"]>[0] = {}) =>
    useCase.execute(query, { now: NOW });
  const ids = (result: Awaited<ReturnType<typeof run>>) =>
    result.items.data.map((item) => item.id);

  it("en Todos ordena destacados primero y luego por nombre, con combos", async () => {
    const result = await run();

    expect(ids(result)).toEqual([
      "p-cafe",
      "p-agua",
      "p-bowl",
      "c-am",
      "p-tarta",
    ]);
    expect(result.totalItems).toBe(5);
    expect(result.items).toMatchObject({ total: 5, page: 1, pageSize: 12 });
  });

  it("cuenta los ítems activos por categoría y lista las preferencias con ítems", async () => {
    const result = await run();

    expect(result.categories).toEqual([
      { slug: "bebidas", name: "Sección bebidas", order: 2, count: 2 },
      {
        slug: "coffee-break",
        name: "Sección coffee-break",
        order: 1,
        count: 2,
      },
    ]);
    expect(result.preferences).toEqual([
      { id: TAG_KETO.id, name: "Keto" },
      { id: TAG_SALUDABLE.id, name: "Saludable" },
    ]);
  });

  it("en una sección respeta el orden de SectionItem y omite ítems inactivos", async () => {
    const result = await run({ section: "bebidas" });

    expect(ids(result)).toEqual(["p-cafe", "p-agua"]);
    expect(result.items.total).toBe(2);
  });

  it("responde 404 si la sección no existe o no está activa", async () => {
    await expect(run({ section: "no-existe" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("filtra por tags exigiendo todos (AND)", async () => {
    expect(ids(await run({ tags: [TAG_SALUDABLE.id] }))).toEqual([
      "p-cafe",
      "p-bowl",
    ]);
    expect(ids(await run({ tags: [TAG_SALUDABLE.id, TAG_KETO.id] }))).toEqual([
      "p-cafe",
    ]);
  });

  it("filtra En oferta por isOnSale", async () => {
    expect(ids(await run({ filter: CatalogFilter.ON_SALE }))).toEqual([
      "p-bowl",
    ]);
  });

  it("Nuevos incluye el borde de 30 días (medianoche de Caracas) y excluye un instante antes", async () => {
    const result = await run({ filter: CatalogFilter.NEW });

    expect(ids(result)).toEqual(["p-bowl"]);
    expect(result.items.data[0].isNew).toBe(true);
    const all = await run();
    expect(all.items.data.find((i) => i.id === "p-tarta")?.isNew).toBe(false);
  });

  it("busca sin distinguir mayúsculas ni acentos en nombre y descripción", async () => {
    expect(ids(await run({ search: "CAFE" }))).toEqual(["p-cafe"]);
    expect(ids(await run({ search: "pina" }))).toEqual(["p-tarta"]);
    expect(ids(await run({ search: "tueste" }))).toEqual(["p-cafe"]);
    expect(ids(await run({ search: "zzz" }))).toEqual([]);
  });

  it("calcula el rango de precio con tamaños activos, precio base o precio del combo", async () => {
    const byId = new Map((await run()).items.data.map((i) => [i.id, i]));

    expect(byId.get("p-cafe")).toMatchObject({
      priceFrom: "3.50",
      priceTo: "6.00",
    });
    expect(byId.get("p-agua")).toMatchObject({
      priceFrom: "2.00",
      priceTo: "2.00",
    });
    expect(byId.get("c-am")).toMatchObject({
      kind: "combo",
      priceFrom: "120.00",
      priceTo: "120.00",
      tags: [],
    });
  });

  it("pagina sobre el resultado filtrado", async () => {
    const page2 = await run({ page: 2, pageSize: 2 });

    expect(ids(page2)).toEqual(["p-bowl", "c-am"]);
    expect(page2.items).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(ids(await run({ page: 9, pageSize: 2 }))).toEqual([]);
  });

  it("devuelve nombres en inglés con fallback a español", async () => {
    const result = await run({ lang: Lang.EN, search: "coffee" });

    expect(result.items.data[0]).toMatchObject({
      name: "American coffee",
      tags: [
        { id: TAG_SALUDABLE.id, name: "Healthy" },
        { id: TAG_KETO.id, name: "Keto" },
      ],
    });
  });

  it("cachea el catálogo activo, no la respuesta: los filtros se aplican en cada consulta", async () => {
    const findSections = jest.fn().mockResolvedValue({ data: sections });
    const findProducts = jest.fn().mockResolvedValue({ data: products });
    const findCombos = jest.fn().mockResolvedValue({ data: combos });
    const cache = new CatalogCacheService();
    const cached = new GetCatalogUseCase(
      { findMany: findSections } as unknown as ISectionRepository,
      { findMany: findProducts } as unknown as IProductRepository,
      { findMany: findCombos } as unknown as IComboRepository,
      cache,
    );

    const todos = await cached.execute({}, { now: NOW });
    const bebidas = await cached.execute({ section: "bebidas" }, { now: NOW });

    expect(ids(todos)).toHaveLength(5);
    expect(ids(bebidas)).toEqual(["p-cafe", "p-agua"]);
    expect(findSections).toHaveBeenCalledTimes(1);
    expect(findProducts).toHaveBeenCalledTimes(1);
    expect(findCombos).toHaveBeenCalledTimes(1);

    cache.invalidar();
    await cached.execute({}, { now: NOW });
    expect(findProducts).toHaveBeenCalledTimes(2);
  });
});
