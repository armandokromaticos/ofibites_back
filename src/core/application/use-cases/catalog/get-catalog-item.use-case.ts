import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import {
  COMBO_FULL_INCLUDE,
  COMBO_REPOSITORY,
} from "../../../domain/repositories/combo.repository.interface";
import type { ISectionRepository } from "../../../domain/repositories/section.repository.interface";
import { SECTION_REPOSITORY } from "../../../domain/repositories/section.repository.interface";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";
import { ProductEntity } from "../../../domain/entities/product.entity";
import { IngredientEntity } from "../../../domain/entities/ingredient.entity";
import { Lang } from "../../../domain/enums/lang.enum";
import {
  CATALOG_ITEM_KIND,
  type CatalogItemKind,
} from "../../../domain/enums/catalog-item-kind.enum";
import { caracasDayStartDaysAgo } from "../../shared/caracas-time.util";
import { CatalogItemDto } from "../../dto/catalog/catalog-response.dto";
import {
  CatalogIngredientDto,
  CatalogItemDetailDto,
} from "../../dto/catalog/catalog-item-detail.dto";
import {
  CATALOG_NEW_DAYS,
  CATALOG_PRODUCT_INCLUDE,
  CatalogEntry,
  catalogEntryFromCombo,
  catalogEntryFromProduct,
  compareCatalogEntries,
  localized,
  toCatalogItemDto,
} from "./catalog-entry.mapper";

/** Máximo de recomendaciones de la ficha. */
export const CATALOG_MAX_RECOMMENDATIONS = 8;

/** Galería e ingredientes activos, ambos en su `sortOrder`. */
const PRODUCT_DETAIL_EXTRAS_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" } },
  ingredients: {
    where: { ingredient: { isActive: true } },
    orderBy: { sortOrder: "asc" },
    include: { ingredient: true },
  },
} as const satisfies Prisma.ProductInclude;

/** Producto de la ficha: lo de la tarjeta (tamaños y tags activos) + extras. */
const PRODUCT_DETAIL_INCLUDE = {
  ...CATALOG_PRODUCT_INCLUDE,
  ...PRODUCT_DETAIL_EXTRAS_INCLUDE,
} as const satisfies Prisma.ProductInclude;

interface ItemRef {
  kind: CatalogItemKind;
  id: string;
}

export interface GetCatalogItemOptions {
  /** Instante de referencia para "Nuevos" (inyectable en tests). */
  now?: Date;
}

@Injectable()
export class GetCatalogItemUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepository: ISectionRepository,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(COMBO_REPOSITORY)
    private readonly comboRepository: IComboRepository,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  /**
   * Ficha de un producto o combo activo con todo lo que muestra el Figma
   * (galería, personas, ingredientes, nutrición) y hasta 8 recomendaciones.
   * Consultas acotadas y en lote: sin N+1 por tamaño, ingrediente ni ítem.
   */
  async execute(
    kind: CatalogItemKind,
    id: string,
    lang: Lang = Lang.ES,
    options: GetCatalogItemOptions = {},
  ): Promise<CatalogItemDetailDto> {
    const newSince = caracasDayStartDaysAgo(CATALOG_NEW_DAYS, options.now);
    const self: ItemRef = { kind, id };

    // La clave lleva el corte de "Nuevos" para no servir isNew de ayer.
    const key = `ficha:${kind}:${id}:${lang}:${newSince.getTime()}`;
    return this.catalogCache.obtener(key, async () => {
      const [detail, sectionRefs] = await Promise.all([
        kind === CATALOG_ITEM_KIND.PRODUCT
          ? this.productDetail(id, lang, newSince)
          : this.comboDetail(id, lang, newSince),
        this.sectionCandidates(self),
      ]);

      detail.recommendations = await this.recommendations(
        self,
        sectionRefs,
        lang,
        newSince,
      );
      return detail;
    });
  }

  private async productDetail(
    id: string,
    lang: Lang,
    newSince: Date,
  ): Promise<CatalogItemDetailDto> {
    const [product, hasRequiredModifiers] = await Promise.all([
      this.productRepository.findUnique({
        where: { id },
        include: PRODUCT_DETAIL_INCLUDE,
      }),
      this.productRepository.exists({
        // Solo grupos obligatorios que se puedan cumplir (con algún modificador activo).
        where: {
          id,
          modifierGroups: {
            some: {
              minSelect: { gt: 0 },
              modifiers: { some: { isActive: true } },
            },
          },
        },
      }),
    ]);
    if (!product || !product.isActive) {
      throw new NotFoundException(
        `No existe un producto activo con id "${id}"`,
      );
    }

    const card = toCatalogItemDto(
      catalogEntryFromProduct(product),
      lang,
      newSince,
    );
    return {
      id: product.id,
      kind: CATALOG_ITEM_KIND.PRODUCT,
      name: card.name,
      description: card.description,
      images: uniqueImages([product.image, ...(product.galleryImages ?? [])]),
      isFeatured: product.isFeatured,
      isOnSale: product.isOnSale,
      isNew: card.isNew,
      tags: card.tags,
      servingOptions: (product.sizes ?? [])
        .filter((size) => size.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((size) => ({
          sizeId: size.id,
          label: localized(lang, size.nameEs, size.nameEn),
          servings: size.servings,
          price: size.price.toFixed(2),
          isDefault: size.isDefault,
        })),
      // Sin tamaños activos el carrito cobra basePrice: se expone para la ficha.
      price: (product.sizes ?? []).some((size) => size.isActive)
        ? null
        : product.basePrice.toFixed(2),
      comboItems: [],
      ingredients: toIngredientDtos(product.ingredients ?? [], lang),
      nutrition: product.hasNutrition ? product.nutrition : null,
      hasRequiredModifiers,
      recommendations: [],
    };
  }

  private async comboDetail(
    id: string,
    lang: Lang,
    newSince: Date,
  ): Promise<CatalogItemDetailDto> {
    const combo = await this.comboRepository.findUnique({
      where: { id },
      include: COMBO_FULL_INCLUDE,
    });
    if (!combo || !combo.isActive) {
      throw new NotFoundException(`No existe un combo activo con id "${id}"`);
    }

    const items = combo.items ?? [];
    const productIds = [...new Set(items.map((item) => item.productId))];
    const { data: products } = productIds.length
      ? await this.productRepository.findMany({
          // Productos inactivos no aportan imágenes ni ingredientes (sí salen en comboItems).
          where: { id: { in: productIds }, isActive: true },
          include: PRODUCT_DETAIL_EXTRAS_INCLUDE,
        })
      : { data: [] as ProductEntity[] };
    const productsById = new Map(products.map((p) => [p.id, p] as const));
    // En el orden del combo (sortOrder de sus ítems).
    const comboProducts = productIds
      .map((productId) => productsById.get(productId))
      .filter((product): product is ProductEntity => product !== undefined);

    const card = toCatalogItemDto(catalogEntryFromCombo(combo), lang, newSince);
    return {
      id: combo.id!,
      kind: CATALOG_ITEM_KIND.COMBO,
      name: card.name,
      description: card.description,
      images: uniqueImages([
        combo.image,
        ...comboProducts.flatMap((product) => [
          product.image,
          ...(product.galleryImages ?? []),
        ]),
      ]),
      isFeatured: combo.isFeatured,
      isOnSale: combo.isOnSale,
      isNew: card.isNew,
      tags: [],
      servingOptions: [],
      price: combo.price.toFixed(2),
      comboItems: items.map((item) => ({
        productId: item.productId,
        name: localized(lang, item.productNameEs, item.productNameEn),
        quantity: item.quantity,
      })),
      ingredients: toIngredientDtos(
        comboProducts.flatMap((product) => product.ingredients ?? []),
        lang,
      ),
      nutrition: null,
      hasRequiredModifiers: false,
      recommendations: [],
    };
  }

  /**
   * Ítems de las secciones activas donde aparece el ítem, en el orden de las
   * secciones y de sus ítems, sin el propio ítem ni repetidos.
   */
  private async sectionCandidates(self: ItemRef): Promise<ItemRef[]> {
    const { data: sections } = await this.sectionRepository.findMany({
      where: {
        isActive: true,
        items: {
          some:
            self.kind === CATALOG_ITEM_KIND.PRODUCT
              ? { productId: self.id }
              : { comboId: self.id },
        },
      },
      orderBy: [{ order: "asc" }, { nameEs: "asc" }],
      include: { items: { orderBy: { order: "asc" } } },
    });

    const seen = new Set<string>([refKey(self)]);
    const refs: ItemRef[] = [];
    for (const section of sections) {
      const items = [...(section.items ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      for (const item of items) {
        const ref: ItemRef | null = item.productId
          ? { kind: CATALOG_ITEM_KIND.PRODUCT, id: item.productId }
          : item.comboId
            ? { kind: CATALOG_ITEM_KIND.COMBO, id: item.comboId }
            : null;
        if (!ref || seen.has(refKey(ref))) continue;
        seen.add(refKey(ref));
        refs.push(ref);
      }
    }
    return refs;
  }

  /**
   * Hasta 8 ítems activos de las mismas secciones; si no hay ninguno, los
   * destacados (mismo orden que "Todos"). Nunca incluye el propio ítem.
   */
  private async recommendations(
    self: ItemRef,
    candidates: ItemRef[],
    lang: Lang,
    newSince: Date,
  ): Promise<CatalogItemDto[]> {
    let entries: CatalogEntry[] = [];

    if (candidates.length > 0) {
      const ids = (kind: CatalogItemKind) =>
        candidates.filter((ref) => ref.kind === kind).map((ref) => ref.id);
      const found = await this.loadEntries(
        { id: { in: ids(CATALOG_ITEM_KIND.PRODUCT) } },
        { id: { in: ids(CATALOG_ITEM_KIND.COMBO) } },
      );
      const byKey = new Map(found.map((entry) => [refKey(entry), entry]));
      entries = candidates
        .map((ref) => byKey.get(refKey(ref)))
        .filter((entry): entry is CatalogEntry => entry !== undefined);
    }

    if (entries.length === 0) {
      const featured = await this.loadEntries(
        { isFeatured: true },
        { isFeatured: true },
      );
      entries = featured
        .filter((entry) => refKey(entry) !== refKey(self))
        .sort((a, b) => compareCatalogEntries(a, b, lang));
    }

    return entries
      .slice(0, CATALOG_MAX_RECOMMENDATIONS)
      .map((entry) => toCatalogItemDto(entry, lang, newSince));
  }

  /** Productos y combos activos que cumplan cada `where`, como tarjetas. */
  private async loadEntries(
    productWhere: Prisma.ProductWhereInput,
    comboWhere: Prisma.ComboWhereInput,
  ): Promise<CatalogEntry[]> {
    const [{ data: products }, { data: combos }] = await Promise.all([
      this.productRepository.findMany({
        where: { ...productWhere, isActive: true },
        include: CATALOG_PRODUCT_INCLUDE,
      }),
      this.comboRepository.findMany({
        where: { ...comboWhere, isActive: true },
      }),
    ]);
    return [
      ...products.map((product) => catalogEntryFromProduct(product)),
      ...combos.map((combo) => catalogEntryFromCombo(combo)),
    ];
  }
}

function refKey(ref: ItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** URLs no vacías, en orden y sin duplicados. */
function uniqueImages(urls: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      urls.filter((url): url is string => typeof url === "string" && !!url),
    ),
  ];
}

/** Ingredientes activos en orden y sin duplicados (unión en combos). */
function toIngredientDtos(
  ingredients: IngredientEntity[],
  lang: Lang,
): CatalogIngredientDto[] {
  const seen = new Set<string>();
  const result: CatalogIngredientDto[] = [];
  for (const ingredient of ingredients) {
    if (!ingredient.isActive || seen.has(ingredient.id)) continue;
    seen.add(ingredient.id);
    result.push({
      id: ingredient.id,
      name: localized(lang, ingredient.nameEs, ingredient.nameEn),
      image: ingredient.image,
    });
  }
  return result;
}
