import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import {
  IProductRepository,
  PRODUCT_FULL_INCLUDE,
} from "../../domain/repositories/product.repository.interface";
import { ProductEntity } from "../../domain/entities/product.entity";

@Injectable()
export class ProductRepository implements IProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: ProductEntity): Promise<ProductEntity> {
    const product = await this.prisma.product.create({
      data: entity.toPrismaCreate(),
      include: PRODUCT_FULL_INCLUDE,
    });
    this.catalogCache.invalidar();
    return ProductEntity.fromPrisma(product);
  }

  async findUnique(
    args: Prisma.ProductFindUniqueArgs,
  ): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique(args);
    return product ? ProductEntity.fromPrisma(product) : null;
  }

  async findMany(
    args?: Prisma.ProductFindManyArgs,
  ): Promise<{ data: ProductEntity[]; total?: number }> {
    const rows = await this.prisma.product.findMany(args);
    const data = rows.map((row) => ProductEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.product.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.ProductUpdateArgs): Promise<ProductEntity> {
    const product = await this.prisma.product.update(args);
    this.catalogCache.invalidar();
    return ProductEntity.fromPrisma(product);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.ProductCountArgs): Promise<boolean> {
    const count = await this.prisma.product.count(args);
    return count > 0;
  }

  async assignTags(
    productId: string,
    tagIds: string[],
  ): Promise<ProductEntity> {
    await this.prisma.productTag.createMany({
      data: tagIds.map((tagId) => ({ productId, tagId })),
      skipDuplicates: true,
    });
    this.catalogCache.invalidar();
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: PRODUCT_FULL_INCLUDE,
    });
    return ProductEntity.fromPrisma(product!);
  }

  async removeTag(productId: string, tagId: string): Promise<void> {
    await this.prisma.productTag.delete({
      where: { productId_tagId: { productId, tagId } },
    });
    this.catalogCache.invalidar();
  }
}
