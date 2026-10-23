import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { CatalogCacheService } from "../catalog-cache/catalog-cache.service";
import { ITagRepository } from "../../domain/repositories/tag.repository.interface";
import { TagEntity } from "../../domain/entities/tag.entity";

@Injectable()
export class TagRepository implements ITagRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogCache: CatalogCacheService,
  ) {}

  async create(entity: TagEntity): Promise<TagEntity> {
    const tag = await this.prisma.tag.create({
      data: entity.toPrismaCreate(),
    });
    this.catalogCache.invalidar();
    return TagEntity.fromPrisma(tag);
  }

  async findUnique(args: Prisma.TagFindUniqueArgs): Promise<TagEntity | null> {
    const tag = await this.prisma.tag.findUnique(args);
    return tag ? TagEntity.fromPrisma(tag) : null;
  }

  async findMany(
    args?: Prisma.TagFindManyArgs,
  ): Promise<{ data: TagEntity[]; total?: number }> {
    const rows = await this.prisma.tag.findMany(args);
    const data = rows.map((row) => TagEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.tag.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.TagUpdateArgs): Promise<TagEntity> {
    const tag = await this.prisma.tag.update(args);
    this.catalogCache.invalidar();
    return TagEntity.fromPrisma(tag);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id } });
    this.catalogCache.invalidar();
  }

  async exists(args: Prisma.TagCountArgs): Promise<boolean> {
    const count = await this.prisma.tag.count(args);
    return count > 0;
  }
}
