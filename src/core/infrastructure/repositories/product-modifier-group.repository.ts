import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import { IProductModifierGroupRepository } from "../../domain/repositories/product-modifier-group.repository.interface";
import { ProductModifierGroupEntity } from "../../domain/entities/product-modifier-group.entity";

@Injectable()
export class ProductModifierGroupRepository implements IProductModifierGroupRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(
    entity: ProductModifierGroupEntity,
  ): Promise<ProductModifierGroupEntity> {
    const group = await this.prisma.productModifierGroup.create({
      data: entity.toPrismaCreate(),
    });
    this.catalogCache.invalidar();
    return ProductModifierGroupEntity.fromPrisma(group);
  }

  async findUnique(
    args: Prisma.ProductModifierGroupFindUniqueArgs,
  ): Promise<ProductModifierGroupEntity | null> {
    const group = await this.prisma.productModifierGroup.findUnique(args);
    return group ? ProductModifierGroupEntity.fromPrisma(group) : null;
  }

  async findMany(
    args?: Prisma.ProductModifierGroupFindManyArgs,
  ): Promise<{ data: ProductModifierGroupEntity[]; total?: number }> {
    const rows = await this.prisma.productModifierGroup.findMany(args);
    const data = rows.map((row) => ProductModifierGroupEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.productModifierGroup.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  async update(
    args: Prisma.ProductModifierGroupUpdateArgs,
  ): Promise<ProductModifierGroupEntity> {
    const group = await this.prisma.productModifierGroup.update(args);
    this.catalogCache.invalidar();
    return ProductModifierGroupEntity.fromPrisma(group);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.productModifierGroup.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.ProductModifierGroupCountArgs): Promise<boolean> {
    const count = await this.prisma.productModifierGroup.count(args);
    return count > 0;
  }
}
