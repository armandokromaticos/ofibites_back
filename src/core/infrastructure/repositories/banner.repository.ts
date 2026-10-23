import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import { IBannerRepository } from "../../domain/repositories/banner.repository.interface";
import { BannerEntity } from "../../domain/entities/banner.entity";

@Injectable()
export class BannerRepository implements IBannerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: BannerEntity): Promise<BannerEntity> {
    const banner = await this.prisma.banner.create({
      data: entity.toPrismaCreate(),
    });
    this.catalogCache.invalidar();
    return BannerEntity.fromPrisma(banner);
  }

  async findUnique(
    args: Prisma.BannerFindUniqueArgs,
  ): Promise<BannerEntity | null> {
    const banner = await this.prisma.banner.findUnique(args);
    return banner ? BannerEntity.fromPrisma(banner) : null;
  }

  async findMany(
    args?: Prisma.BannerFindManyArgs,
  ): Promise<{ data: BannerEntity[]; total?: number }> {
    const rows = await this.prisma.banner.findMany(args);
    const data = rows.map((row) => BannerEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.banner.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.BannerUpdateArgs): Promise<BannerEntity> {
    const banner = await this.prisma.banner.update(args);
    this.catalogCache.invalidar();
    return BannerEntity.fromPrisma(banner);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.banner.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.BannerCountArgs): Promise<boolean> {
    const count = await this.prisma.banner.count(args);
    return count > 0;
  }

  async findAllActive(section?: string): Promise<BannerEntity[]> {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        ...(section ? { section } : {}),
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      },
      orderBy: { order: "asc" },
    });
    return banners.map((banner) => BannerEntity.fromPrisma(banner));
  }
}
