import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import {
  ISectionRepository,
  SECTION_FULL_INCLUDE,
} from "../../domain/repositories/section.repository.interface";
import { SectionEntity } from "../../domain/entities/section.entity";

@Injectable()
export class SectionRepository implements ISectionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: SectionEntity): Promise<SectionEntity> {
    const section = await this.prisma.section.create({
      data: entity.toPrismaCreate(),
      include: SECTION_FULL_INCLUDE,
    });
    this.catalogCache.invalidar();
    return SectionEntity.fromPrisma(section);
  }

  async findUnique(
    args: Prisma.SectionFindUniqueArgs,
  ): Promise<SectionEntity | null> {
    const section = await this.prisma.section.findUnique(args);
    return section ? SectionEntity.fromPrisma(section) : null;
  }

  async findMany(
    args?: Prisma.SectionFindManyArgs,
  ): Promise<{ data: SectionEntity[]; total?: number }> {
    const rows = await this.prisma.section.findMany(args);
    const data = rows.map((row) => SectionEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.section.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.SectionUpdateArgs): Promise<SectionEntity> {
    const section = await this.prisma.section.update(args);
    this.catalogCache.invalidar();
    return SectionEntity.fromPrisma(section);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.section.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.SectionCountArgs): Promise<boolean> {
    const count = await this.prisma.section.count(args);
    return count > 0;
  }

  async addItem(
    sectionId: string,
    productId: string | null,
    comboId: string | null,
    order: number,
  ): Promise<SectionEntity> {
    const hasProduct = productId !== null;
    const hasCombo = comboId !== null;
    if (hasProduct === hasCombo) {
      throw new Error("Exactly one of productId or comboId must be provided");
    }
    await this.prisma.sectionItem.create({
      data: { sectionId, productId, comboId, order },
    });
    this.catalogCache.invalidar();
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: SECTION_FULL_INCLUDE,
    });
    return SectionEntity.fromPrisma(section!);
  }

  async removeItem(sectionId: string, itemId: string): Promise<number> {
    const result = await this.prisma.sectionItem.deleteMany({
      where: { id: itemId, sectionId },
    });
    this.catalogCache.invalidar();
    return result.count;
  }

  async reorderItems(
    sectionId: string,
    items: { itemId: string; order: number }[],
  ): Promise<SectionEntity> {
    const itemIds = items.map((entry) => entry.itemId);
    const foundItems = await this.prisma.sectionItem.findMany({
      where: { id: { in: itemIds }, sectionId },
      select: { id: true },
    });
    const foundIds = new Set(foundItems.map((found) => found.id));
    const invalid = itemIds.filter((id) => !foundIds.has(id));
    if (invalid.length > 0) {
      throw new Error(
        `Items [${invalid.join(", ")}] do not belong to section ${sectionId}`,
      );
    }
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.sectionItem.updateMany({
          where: { id: item.itemId, sectionId },
          data: { order: item.order },
        }),
      ),
    );
    this.catalogCache.invalidar();
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: SECTION_FULL_INCLUDE,
    });
    return SectionEntity.fromPrisma(section!);
  }
}
