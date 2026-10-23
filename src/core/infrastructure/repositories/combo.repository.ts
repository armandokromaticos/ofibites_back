import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import {
  COMBO_FULL_INCLUDE,
  IComboRepository,
} from "../../domain/repositories/combo.repository.interface";
import { ComboEntity } from "../../domain/entities/combo.entity";

@Injectable()
export class ComboRepository implements IComboRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: ComboEntity): Promise<ComboEntity> {
    const combo = await this.prisma.combo.create({
      data: entity.toPrismaCreate(),
      include: COMBO_FULL_INCLUDE,
    });
    this.catalogCache.invalidar();
    return ComboEntity.fromPrisma(combo);
  }

  async findUnique(
    args: Prisma.ComboFindUniqueArgs,
  ): Promise<ComboEntity | null> {
    const combo = await this.prisma.combo.findUnique(args);
    return combo ? ComboEntity.fromPrisma(combo) : null;
  }

  async findMany(
    args?: Prisma.ComboFindManyArgs,
  ): Promise<{ data: ComboEntity[]; total?: number }> {
    const rows = await this.prisma.combo.findMany(args);
    const data = rows.map((row) => ComboEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.combo.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.ComboUpdateArgs): Promise<ComboEntity> {
    const combo = await this.prisma.combo.update(args);
    this.catalogCache.invalidar();
    return ComboEntity.fromPrisma(combo);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.combo.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.ComboCountArgs): Promise<boolean> {
    const count = await this.prisma.combo.count(args);
    return count > 0;
  }

  async addItem(
    comboId: string,
    productId: string,
    quantity: number,
    sortOrder: number = 0,
  ): Promise<ComboEntity> {
    await this.prisma.comboItem.create({
      data: { comboId, productId, quantity, sortOrder },
    });
    this.catalogCache.invalidar();
    const combo = await this.prisma.combo.findUnique({
      where: { id: comboId },
      include: COMBO_FULL_INCLUDE,
    });
    if (!combo) {
      throw new NotFoundException(
        `Combo with id ${comboId} not found after addItem`,
      );
    }
    return ComboEntity.fromPrisma(combo);
  }

  async removeItem(comboId: string, itemId: string): Promise<ComboEntity> {
    const result = await this.prisma.comboItem.deleteMany({
      where: { id: itemId, comboId },
    });
    this.catalogCache.invalidar();
    if (result.count === 0) {
      throw new NotFoundException(
        `Item with id ${itemId} not found in combo ${comboId}`,
      );
    }
    const combo = await this.prisma.combo.findUnique({
      where: { id: comboId },
      include: COMBO_FULL_INCLUDE,
    });
    if (!combo) {
      throw new NotFoundException(
        `Combo with id ${comboId} not found after removeItem`,
      );
    }
    return ComboEntity.fromPrisma(combo);
  }
}
