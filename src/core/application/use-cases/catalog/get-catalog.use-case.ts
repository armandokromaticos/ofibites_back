import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import { COMBO_REPOSITORY } from "../../../domain/repositories/combo.repository.interface";
import type { ISectionRepository } from "../../../domain/repositories/section.repository.interface";
import { SECTION_REPOSITORY } from "../../../domain/repositories/section.repository.interface";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";
import { TagEntity } from "../../../domain/entities/tag.entity";
import { CatalogFilter } from "../../../domain/enums/catalog-filter.enum";
import { Lang } from "../../../domain/enums/lang.enum";
import { caracasDayStartDaysAgo } from "../../shared/caracas-time.util";
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  GetCatalogQueryDto,
} from "../../dto/catalog/get-catalog-query.dto";
import {
  CatalogCategoryDto,
  CatalogResponseDto,
  CatalogTagDto,
} from "../../dto/catalog/catalog-response.dto";
import {
  CATALOG_NEW_DAYS,
  CATALOG_PRODUCT_INCLUDE,
  CatalogEntry,
  catalogEntryFromCombo,
  catalogEntryFromProduct,
  compareCatalogEntries,
  localized,
  toCatalogItemDto,
  toCatalogTagDto,
} from "./catalog-entry.mapper";

/** Productos activos con solo sus tamaños activos y sus tags activos. */
const CATALOG_PRODUCT_ARGS = {
  where: { isActive: true },
  include: CATALOG_PRODUCT_INCLUDE,
} as const satisfies Prisma.ProductFindManyArgs;

/** Secciones activas con sus ítems (solo ids y orden, sin relaciones). */
const CATALOG_SECTION_ARGS = {
  where: { isActive: true },
  orderBy: [{ order: "asc" }, { nameEs: "asc" }],
  include: { items: { orderBy: { order: "asc" } } },
} as const satisfies Prisma.SectionFindManyArgs;

export interface GetCatalogOptions {
  /** Instante de referencia para "Nuevos" (inyectable en tests). */
  now?: Date;
}

@Injectable()
export class GetCatalogUseCase {
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
   * Arma el catálogo del cliente con 3 consultas (secciones, productos y
   * combos activos) y resuelve filtros, orden y paginación en memoria: hace
   * falta el catálogo activo completo para los conteos por categoría y las
   * preferencias, y así la búsqueda puede ignorar acentos sin `unaccent`.
   */
  async execute(
    query: GetCatalogQueryDto,
    options: GetCatalogOptions = {},
  ): Promise<CatalogResponseDto> {
    const lang = query.lang ?? Lang.ES;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE;
    const newSince = caracasDayStartDaysAgo(CATALOG_NEW_DAYS, options.now);

    // Cachea el catálogo activo, no la respuesta: filtros, "Nuevos" y
    // paginación se siguen calculando en cada petición.
    const [{ data: sections }, { data: products }, { data: combos }] =
      await this.catalogCache.obtener("catalogo:activo", () =>
        Promise.all([
          this.sectionRepository.findMany(CATALOG_SECTION_ARGS),
          this.productRepository.findMany(CATALOG_PRODUCT_ARGS),
          this.comboRepository.findMany({ where: { isActive: true } }),
        ]),
      );

    const selectedSection = query.section
      ? sections.find((section) => section.slug === query.section)
      : undefined;
    if (query.section && !selectedSection) {
      throw new NotFoundException(
        `No existe una categoría activa con slug "${query.section}"`,
      );
    }

    const entries = [
      ...products.map((product) => catalogEntryFromProduct(product)),
      ...combos.map((combo) => catalogEntryFromCombo(combo)),
    ];
    const productEntries = new Map<string, CatalogEntry>();
    const comboEntries = new Map<string, CatalogEntry>();
    for (const entry of entries) {
      (entry.kind === "product" ? productEntries : comboEntries).set(
        entry.id,
        entry,
      );
    }

    const sectionEntries = (sectionId: string): CatalogEntry[] => {
      const section = sections.find((s) => s.id === sectionId);
      const items = [...(section?.items ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      const result: CatalogEntry[] = [];
      for (const item of items) {
        const entry = item.productId
          ? productEntries.get(item.productId)
          : item.comboId
            ? comboEntries.get(item.comboId)
            : undefined;
        if (entry) result.push(entry);
      }
      return result;
    };

    const categories: CatalogCategoryDto[] = sections.map((section) => ({
      slug: section.slug,
      name: localized(lang, section.nameEs, section.nameEn),
      order: section.order,
      count: sectionEntries(section.id).length,
    }));

    const preferences = this.collectPreferences(entries, lang);

    const base = selectedSection
      ? sectionEntries(selectedSection.id)
      : [...entries].sort((a, b) => compareCatalogEntries(a, b, lang));

    const needle = query.search ? normalizeForSearch(query.search) : undefined;
    const filtered = base.filter((entry) =>
      this.matches(entry, query, newSince, needle),
    );
    const start = (page - 1) * pageSize;

    return {
      categories,
      totalItems: entries.length,
      preferences,
      items: {
        data: filtered
          .slice(start, start + pageSize)
          .map((entry) => toCatalogItemDto(entry, lang, newSince)),
        total: filtered.length,
        page,
        pageSize,
      },
    };
  }

  private matches(
    entry: CatalogEntry,
    query: GetCatalogQueryDto,
    newSince: Date,
    needle: string | undefined,
  ): boolean {
    if (query.tags?.length) {
      const entryTagIds = new Set(entry.tags.map((tag) => tag.id));
      if (!query.tags.every((tagId) => entryTagIds.has(tagId))) return false;
    }
    if (query.filter === CatalogFilter.NEW && entry.createdAt < newSince) {
      return false;
    }
    if (query.filter === CatalogFilter.ON_SALE && !entry.isOnSale) {
      return false;
    }
    if (needle) {
      const haystack = [
        entry.nameEs,
        entry.nameEn,
        entry.descriptionEs,
        entry.descriptionEn,
      ];
      if (
        !haystack.some(
          (text) => text && normalizeForSearch(text).includes(needle),
        )
      ) {
        return false;
      }
    }
    return true;
  }

  /** Tags activos que tienen al menos un ítem activo, ordenados por nombre. */
  private collectPreferences(
    entries: CatalogEntry[],
    lang: Lang,
  ): CatalogTagDto[] {
    const byId = new Map<string, TagEntity>();
    for (const entry of entries) {
      for (const tag of entry.tags) byId.set(tag.id, tag);
    }
    return [...byId.values()]
      .map((tag) => toCatalogTagDto(tag, lang))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }
}

/** Minúsculas y sin diacríticos: "Café" y "cafe" coinciden. */
function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
