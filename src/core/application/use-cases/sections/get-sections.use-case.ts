import { Inject, Injectable } from "@nestjs/common";
import type { ISectionRepository } from "../../../domain/repositories/section.repository.interface";
import {
  SECTION_FULL_INCLUDE,
  SECTION_REPOSITORY,
} from "../../../domain/repositories/section.repository.interface";
import { SectionEntity } from "../../../domain/entities/section.entity";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";

@Injectable()
export class GetSectionsUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepository: ISectionRepository,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async execute(activeOnly?: boolean): Promise<SectionEntity[]> {
    const where = activeOnly ? { isActive: true } : undefined;
    const include = activeOnly
      ? {
          items: {
            ...SECTION_FULL_INCLUDE.items,
            where: {
              OR: [
                { product: { isActive: true } },
                { combo: { isActive: true } },
              ],
            },
          },
        }
      : SECTION_FULL_INCLUDE;
    const load = () =>
      this.sectionRepository.findMany({
        where,
        include,
        orderBy: { order: "asc" },
      });
    // Solo la lista pública (activas); la de admin va siempre a la BD.
    const { data } = activeOnly
      ? await this.catalogCache.obtener("secciones:activas", load)
      : await load();
    return data;
  }
}
