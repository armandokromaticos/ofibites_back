import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  CompanyMembershipDetails,
  ICompanyMemberRepository,
} from "../../domain/repositories/company-member.repository.interface";
import { CompanyMemberEntity } from "../../domain/entities/company-member.entity";
import { CompanyRole } from "../../domain/enums/company-role.enum";
import { AuthUserCacheService } from "../cache/auth-user-cache.service";

const MEMBERSHIP_REFS_INCLUDE = {
  company: { select: { id: true, legalName: true, isActive: true } },
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
} as const satisfies Prisma.CompanyMemberInclude;

type MemberWithRefs = Prisma.CompanyMemberGetPayload<{
  include: typeof MEMBERSHIP_REFS_INCLUDE;
}>;

@Injectable()
export class CompanyMemberRepository implements ICompanyMemberRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  private toMembershipDetails(row: MemberWithRefs): CompanyMembershipDetails {
    return {
      membershipId: row.id,
      companyId: row.companyId,
      companyName: row.company.legalName,
      companyIsActive: row.company.isActive,
      role: row.role as CompanyRole,
      position: row.position,
      branchId: row.branchId,
      branchName: row.branch?.name ?? null,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      canPayInvoices: row.canPayInvoices,
      isActive: row.isActive,
    };
  }

  async create(entity: CompanyMemberEntity): Promise<CompanyMemberEntity> {
    const created = await this.prisma.companyMember.create({
      data: entity.toPrismaCreate(),
    });
    // Ninguna escritura de miembros sale de este repositorio: aquí se
    // invalida la membresía que cachean los guards de empresa.
    this.authUserCache.invalidarMembresia(created.userId, created.companyId);
    return CompanyMemberEntity.fromPrisma(created);
  }

  async findUnique(
    args: Prisma.CompanyMemberFindUniqueArgs,
  ): Promise<CompanyMemberEntity | null> {
    const member = await this.prisma.companyMember.findUnique(args);
    return member ? CompanyMemberEntity.fromPrisma(member) : null;
  }

  async findFirst(
    args: Prisma.CompanyMemberFindFirstArgs,
  ): Promise<CompanyMemberEntity | null> {
    const member = await this.prisma.companyMember.findFirst(args);
    return member ? CompanyMemberEntity.fromPrisma(member) : null;
  }

  async findMany(
    args?: Prisma.CompanyMemberFindManyArgs,
  ): Promise<{ data: CompanyMemberEntity[]; total?: number }> {
    const rows = await this.prisma.companyMember.findMany(args);
    const data = rows.map((row) => CompanyMemberEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.companyMember.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  async update(
    args: Prisma.CompanyMemberUpdateArgs,
  ): Promise<CompanyMemberEntity> {
    const updated = await this.prisma.companyMember.update(args);
    this.authUserCache.invalidarMembresia(updated.userId, updated.companyId);
    return CompanyMemberEntity.fromPrisma(updated);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.prisma.companyMember.delete({ where: { id } });
    this.authUserCache.invalidarMembresia(deleted.userId, deleted.companyId);
  }

  async exists(args: Prisma.CompanyMemberCountArgs): Promise<boolean> {
    const count = await this.prisma.companyMember.count(args);
    return count > 0;
  }

  async findActiveByUserAndCompany(
    userId: string,
    companyId: string,
  ): Promise<CompanyMemberEntity | null> {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId, companyId, isActive: true },
    });
    return member ? CompanyMemberEntity.fromPrisma(member) : null;
  }

  async findAllByUserIdWithRefs(
    userId: string,
  ): Promise<CompanyMembershipDetails[]> {
    const rows = await this.prisma.companyMember.findMany({
      where: { userId },
      include: MEMBERSHIP_REFS_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => this.toMembershipDetails(row));
  }

  async findAllByUserIdsWithRefs(
    userIds: string[],
  ): Promise<(CompanyMembershipDetails & { userId: string })[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.companyMember.findMany({
      where: { userId: { in: userIds } },
      include: MEMBERSHIP_REFS_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => ({
      userId: row.userId,
      ...this.toMembershipDetails(row),
    }));
  }

  async findActiveCompanyIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.companyMember.findMany({
      where: { userId, isActive: true },
      select: { companyId: true },
    });
    return rows.map((row) => row.companyId);
  }

  async findActiveByCompanyId(
    companyId: string,
  ): Promise<CompanyMemberEntity[]> {
    const rows = await this.prisma.companyMember.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => CompanyMemberEntity.fromPrisma(row));
  }

  async touchLastSeenIfStale(
    authId: string,
    companyId: string,
    debounceMs: number,
  ): Promise<void> {
    // Sin invalidar la caché de membresías: solo toca lastSeenAt (ni rol ni
    // isActive) y corre en cada request con X-Company-Id; vaciarla aquí la
    // dejaría sin efecto.
    const threshold = new Date(Date.now() - debounceMs);
    await this.prisma.companyMember.updateMany({
      where: {
        companyId,
        isActive: true,
        user: { authId },
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
      },
      data: { lastSeenAt: new Date() },
    });
  }
}
