import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import { IProductSizeRepository } from "../../domain/repositories/product-size.repository.interface";
import { ProductSizeEntity } from "../../domain/entities/product-size.entity";

@Injectable()
export class ProductSizeRepository implements IProductSizeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: ProductSizeEntity): Promise<ProductSizeEntity> {
    const size = await this.prisma.productSize.create({
      data: entity.toPrismaCreate(),
    });
    this.catalogCache.invalidar();
    return ProductSizeEntity.fromPrisma(size);
  }

  async findUnique(
    args: Prisma.ProductSizeFindUniqueArgs,
  ): Promise<ProductSizeEntity | null> {
    const size = await this.prisma.productSize.findUnique(args);
    return size ? ProductSizeEntity.fromPrisma(size) : null;
  }

  async findMany(
    args?: Prisma.ProductSizeFindManyArgs,
  ): Promise<{ data: ProductSizeEntity[]; total?: number }> {
    const rows = await this.prisma.productSize.findMany(args);
    const data = rows.map((row) => ProductSizeEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.productSize.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.ProductSizeUpdateArgs): Promise<ProductSizeEntity> {
    const size = await this.prisma.productSize.update(args);
    this.catalogCache.invalidar();
    return ProductSizeEntity.fromPrisma(size);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.productSize.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.ProductSizeCountArgs): Promise<boolean> {
    const count = await this.prisma.productSize.count(args);
    return count > 0;
  }
}
