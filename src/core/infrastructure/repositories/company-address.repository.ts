import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { ICompanyAddressRepository } from "../../domain/repositories/company-address.repository.interface";
import { CompanyAddressEntity } from "../../domain/entities/company-address.entity";

@Injectable()
export class CompanyAddressRepository implements ICompanyAddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: CompanyAddressEntity): Promise<CompanyAddressEntity> {
    const address = await this.prisma.companyAddress.create({
      data: entity.toPrismaCreate(),
    });
    return CompanyAddressEntity.fromPrisma(address);
  }

  async findUnique(
    args: Prisma.CompanyAddressFindUniqueArgs,
  ): Promise<CompanyAddressEntity | null> {
    const address = await this.prisma.companyAddress.findUnique(args);
    return address ? CompanyAddressEntity.fromPrisma(address) : null;
  }

  async findMany(
    args?: Prisma.CompanyAddressFindManyArgs,
  ): Promise<{ data: CompanyAddressEntity[]; total?: number }> {
    const rows = await this.prisma.companyAddress.findMany(args);
    const data = rows.map((row) => CompanyAddressEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.companyAddress.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  async update(
    args: Prisma.CompanyAddressUpdateArgs,
  ): Promise<CompanyAddressEntity> {
    const address = await this.prisma.companyAddress.update(args);
    return CompanyAddressEntity.fromPrisma(address);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyAddress.delete({ where: { id } });
  }

  async exists(args: Prisma.CompanyAddressCountArgs): Promise<boolean> {
    const count = await this.prisma.companyAddress.count(args);
    return count > 0;
  }

  async setSingleBilling(companyId: string, targetId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.companyAddress.updateMany({
        where: { companyId, isBilling: true, NOT: { id: targetId } },
        data: { isBilling: false },
      }),
      this.prisma.companyAddress.update({
        where: { companyId_id: { companyId, id: targetId } },
        data: { isBilling: true },
      }),
    ]);
  }

  async createAndSetSingleBilling(
    entity: CompanyAddressEntity,
  ): Promise<CompanyAddressEntity> {
    const data = entity.toPrismaCreate();
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.companyAddress.create({ data });
      await tx.companyAddress.updateMany({
        where: {
          companyId: entity.companyId,
          isBilling: true,
          NOT: { id: row.id },
        },
        data: { isBilling: false },
      });
      return row;
    });
    return CompanyAddressEntity.fromPrisma(created);
  }

  async setSinglePrimary(companyId: string, targetId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.companyAddress.updateMany({
        where: { companyId, isPrimary: true, NOT: { id: targetId } },
        data: { isPrimary: false },
      }),
      this.prisma.companyAddress.update({
        where: { companyId_id: { companyId, id: targetId } },
        data: { isPrimary: true },
      }),
    ]);
  }

  async createAndSetSinglePrimary(
    entity: CompanyAddressEntity,
  ): Promise<CompanyAddressEntity> {
    const data = entity.toPrismaCreate();
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.companyAddress.create({ data });
      await tx.companyAddress.updateMany({
        where: {
          companyId: entity.companyId,
          isPrimary: true,
          NOT: { id: row.id },
        },
        data: { isPrimary: false },
      });
      return row;
    });
    return CompanyAddressEntity.fromPrisma(created);
  }
}
