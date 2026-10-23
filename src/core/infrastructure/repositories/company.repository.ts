import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { ICompanyRepository } from "../../domain/repositories/company.repository.interface";
import { CompanyEntity } from "../../domain/entities/company.entity";
import { AuthUserCacheService } from "../cache/auth-user-cache.service";

@Injectable()
export class CompanyRepository implements ICompanyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async create(entity: CompanyEntity): Promise<CompanyEntity> {
    const company = await this.prisma.company.create({
      data: entity.toPrismaCreate(),
    });
    return CompanyEntity.fromPrisma(company);
  }

  async findUnique(
    args: Prisma.CompanyFindUniqueArgs,
  ): Promise<CompanyEntity | null> {
    const company = await this.prisma.company.findUnique(args);
    return company ? CompanyEntity.fromPrisma(company) : null;
  }

  async findMany(
    args?: Prisma.CompanyFindManyArgs,
  ): Promise<{ data: CompanyEntity[]; total?: number }> {
    const rows = await this.prisma.company.findMany(args);
    const data = rows.map((row) => CompanyEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.company.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.CompanyUpdateArgs): Promise<CompanyEntity> {
    const company = await this.prisma.company.update(args);
    return CompanyEntity.fromPrisma(company);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
    // Borra en cascada sus membresías.
    this.authUserCache.invalidarMembresias();
  }

  async exists(args: Prisma.CompanyCountArgs): Promise<boolean> {
    const count = await this.prisma.company.count(args);
    return count > 0;
  }
}
