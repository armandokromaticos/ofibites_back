import { Prisma } from "@prisma/client";
import { ProductEntity } from "../../../domain/entities/product.entity";
import { ComboEntity } from "../../../domain/entities/combo.entity";
import { TagEntity } from "../../../domain/entities/tag.entity";
import { Lang } from "../../../domain/enums/lang.enum";
import {
  CatalogItemDto,
  CatalogItemKind,
  CatalogTagDto,
} from "../../dto/catalog/catalog-response.dto";

/**
 * Mapeo compartido de productos y combos a `CatalogItem` (tarjeta del
 * catálogo). Lo usan `GET /catalog` y las recomendaciones de la ficha
 * (`GET /catalog/items/:kind/:id`) para que ambas tarjetas sean idénticas.
 */

/** "Nuevos" = creados desde la medianoche (Caracas) de hace 30 días. */
export const CATALOG_NEW_DAYS = 30;

/** Include de un producto como tarjeta: solo tamaños activos y tags activos. */
export const CATALOG_PRODUCT_INCLUDE = {
  sizes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
  tags: { where: { tag: { isActive: true } }, include: { tag: true } },
} as const satisfies Prisma.ProductInclude;

/** Vista interna de un ítem vendible del catálogo (producto o combo). */
export interface CatalogEntry {
  kind: CatalogItemKind;
  id: string;
  nameEs: string;
  nameEn: string | null;
  descriptionEs: string | null;
  descriptionEn: string | null;
  image: string | null;
  priceMin: number;
  priceMax: number;
  tags: TagEntity[];
  createdAt: Date;
  isFeatured: boolean;
  isOnSale: boolean;
}

export function catalogEntryFromProduct(product: ProductEntity): CatalogEntry {
  const { min, max } = product.priceRange;
  return {
    kind: "product",
    id: product.id,
    nameEs: product.nameEs,
    nameEn: product.nameEn,
    descriptionEs: product.descriptionEs,
    descriptionEn: product.descriptionEn,
    image: product.image,
    priceMin: min,
    priceMax: max,
    tags: (product.tags ?? []).filter((tag) => tag.isActive),
    createdAt: product.createdAt,
    isFeatured: product.isFeatured,
    isOnSale: product.isOnSale,
  };
}

export function catalogEntryFromCombo(combo: ComboEntity): CatalogEntry {
  return {
    kind: "combo",
    id: combo.id!,
    nameEs: combo.nameEs,
    nameEn: combo.nameEn,
    descriptionEs: combo.descriptionEs,
    descriptionEn: combo.descriptionEn,
    image: combo.image,
    priceMin: combo.price,
    priceMax: combo.price,
    tags: [],
    createdAt: combo.createdAt,
    isFeatured: combo.isFeatured,
    isOnSale: combo.isOnSale,
  };
}

/** "Todos": destacados primero y luego por nombre en el idioma pedido. */
export function compareCatalogEntries(
  a: CatalogEntry,
  b: CatalogEntry,
  lang: Lang,
): number {
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  const byName = localized(lang, a.nameEs, a.nameEn).localeCompare(
    localized(lang, b.nameEs, b.nameEn),
    lang,
    { sensitivity: "base" },
  );
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

export function toCatalogItemDto(
  entry: CatalogEntry,
  lang: Lang,
  newSince: Date,
): CatalogItemDto {
  return {
    id: entry.id,
    kind: entry.kind,
    name: localized(lang, entry.nameEs, entry.nameEn),
    description: localizedDescription(
      lang,
      entry.descriptionEs,
      entry.descriptionEn,
    ),
    image: entry.image,
    priceFrom: entry.priceMin.toFixed(2),
    priceTo: entry.priceMax.toFixed(2),
    tags: entry.tags
      .map((tag) => toCatalogTagDto(tag, lang))
      .sort((a, b) => a.name.localeCompare(b.name, lang)),
    isNew: entry.createdAt >= newSince,
    isFeatured: entry.isFeatured,
    isOnSale: entry.isOnSale,
  };
}

/** Texto en el idioma pedido; en inglés cae al español si falta. */
export function localized(lang: Lang, es: string, en: string | null): string {
  return lang === Lang.EN ? en?.trim() || es : es;
}

export function localizedDescription(
  lang: Lang,
  es: string | null,
  en: string | null,
): string | null {
  return lang === Lang.EN ? en?.trim() || es : es;
}

export function toCatalogTagDto(tag: TagEntity, lang: Lang): CatalogTagDto {
  return { id: tag.id, name: localized(lang, tag.nameEs, tag.nameEn) };
}
