import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import {
  IProductModifierRepository,
  ModifierSizePriceEntry,
  PRODUCT_MODIFIER_FULL_INCLUDE,
} from "../../domain/repositories/product-modifier.repository.interface";
import { ProductModifierEntity } from "../../domain/entities/product-modifier.entity";

@Injectable()
export class ProductModifierRepository implements IProductModifierRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: ProductModifierEntity): Promise<ProductModifierEntity> {
    const modifier = await this.prisma.productModifier.create({
      data: entity.toPrismaCreate(),
      include: PRODUCT_MODIFIER_FULL_INCLUDE,
    });
    this.catalogCache.invalidar();
    return ProductModifierEntity.fromPrisma(modifier);
  }

  async findUnique(
    args: Prisma.ProductModifierFindUniqueArgs,
  ): Promise<ProductModifierEntity | null> {
    const modifier = await this.prisma.productModifier.findUnique(args);
    return modifier ? ProductModifierEntity.fromPrisma(modifier) : null;
  }

  async findMany(
    args?: Prisma.ProductModifierFindManyArgs,
  ): Promise<{ data: ProductModifierEntity[]; total?: number }> {
    const rows = await this.prisma.productModifier.findMany(args);
    const data = rows.map((row) => ProductModifierEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.productModifier.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  async update(
    args: Prisma.ProductModifierUpdateArgs,
  ): Promise<ProductModifierEntity> {
    const modifier = await this.prisma.productModifier.update(args);
    this.catalogCache.invalidar();
    return ProductModifierEntity.fromPrisma(modifier);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.productModifier.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.ProductModifierCountArgs): Promise<boolean> {
    const count = await this.prisma.productModifier.count(args);
    return count > 0;
  }

  async assignTags(modifierId: string, tagIds: string[]): Promise<void> {
    await this.prisma.productModifierTag.createMany({
      data: tagIds.map((tagId) => ({ modifierId, tagId })),
      skipDuplicates: true,
    });
    this.catalogCache.invalidar();
  }

  async removeTag(modifierId: string, tagId: string): Promise<void> {
    await this.prisma.productModifierTag.delete({
      where: { modifierId_tagId: { modifierId, tagId } },
    });
    this.catalogCache.invalidar();
  }

  async setSizePrices(
    modifierId: string,
    entries: ModifierSizePriceEntry[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.modifierSizePrice.deleteMany({ where: { modifierId } }),
      this.prisma.modifierSizePrice.createMany({
        data: entries.map((entry) => ({
          modifierId,
          productSizeId: entry.productSizeId,
          priceAdjustment: new Prisma.Decimal(entry.priceAdjustment),
        })),
      }),
    ]);
    this.catalogCache.invalidar();
  }

  async findSizePrices(modifierId: string): Promise<ModifierSizePriceEntry[]> {
    const records = await this.prisma.modifierSizePrice.findMany({
      where: { modifierId },
    });
    return records.map((record) => ({
      productSizeId: record.productSizeId,
      priceAdjustment: Number(record.priceAdjustment),
    }));
  }

  async findSizePrice(
    modifierId: string,
    productSizeId: string,
  ): Promise<number | null> {
    const record = await this.prisma.modifierSizePrice.findUnique({
      where: { modifierId_productSizeId: { modifierId, productSizeId } },
    });
    return record ? Number(record.priceAdjustment) : null;
  }

  async findSizePricesBatch(
    modifierIds: string[],
    productSizeIds: string[],
  ): Promise<Map<string, Map<string, number>>> {
    const records = await this.prisma.modifierSizePrice.findMany({
      where: {
        modifierId: { in: modifierIds },
        productSizeId: { in: productSizeIds },
      },
    });
    const bySize = new Map<string, Map<string, number>>();
    for (const record of records) {
      const prices =
        bySize.get(record.productSizeId) ?? new Map<string, number>();
      prices.set(record.modifierId, Number(record.priceAdjustment));
      bySize.set(record.productSizeId, prices);
    }
    return bySize;
  }
}
