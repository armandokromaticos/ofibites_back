import { Inject, Injectable } from "@nestjs/common";
import type { IBannerRepository } from "../../../domain/repositories/banner.repository.interface";
import { BANNER_REPOSITORY } from "../../../domain/repositories/banner.repository.interface";
import { BannerEntity } from "../../../domain/entities/banner.entity";
import { CatalogCacheService } from "../../../infrastructure/catalog-cache/catalog-cache.service";

@Injectable()
export class GetBannersUseCase {
  constructor(
    @Inject(BANNER_REPOSITORY)
    private readonly bannerRepository: IBannerRepository,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async execute(
    section?: string,
    activeOnly?: boolean,
  ): Promise<BannerEntity[]> {
    if (activeOnly) {
      // Las fechas de inicio/fin se aplican con hasta un TTL de retraso.
      return this.catalogCache.obtener(`banners:activos:${section ?? ""}`, () =>
        this.bannerRepository.findAllActive(section),
      );
    }
    const where = section ? { section } : undefined;
    const { data } = await this.bannerRepository.findMany({
      where,
      orderBy: { order: "asc" },
    });
    return data;
  }
}
