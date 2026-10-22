import { CompanyMember as PrismaCompanyMember, Prisma } from "@prisma/client";
import { CompanyRole } from "../enums/company-role.enum";

export interface CreateCompanyMemberParams {
  userId: string;
  companyId: string;
  role: CompanyRole;
  position?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  canPayInvoices?: boolean;
  isActive?: boolean;
}

/**
 * Fila de `CompanyMember` con el `user` relacionado opcionalmente incluido
 * (`include: { user: { select: { name, email, phone } } }`). El repositorio
 * genérico (`findMany`/`findUnique`) sigue devolviendo el tipo base de Prisma,
 * así que esta forma amplía esa base sin exigir la relación: solo se
 * completa cuando el caller pidió el include.
 */
type PrismaCompanyMemberWithUser = PrismaCompanyMember & {
  user?: { name: string; email: string; phone: string | null };
};

export class CompanyMemberEntity {
  id: string;
  userId: string;
  companyId: string;
  role: CompanyRole;
  position: string | null;
  branchId: string | null;
  departmentId: string | null;
  canPayInvoices: boolean;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Datos del `User` asociado. Solo presentes si `fromPrisma` recibió la fila
   * con `user` incluido, o si un use-case los asignó a mano tras crear/
   * actualizar el miembro (cuando ya tenía el `UserEntity` a mano y no valía
   * la pena pedir el include de nuevo).
   */
  userName?: string;
  userEmail?: string;
  userPhone?: string | null;

  static fromPrisma(prisma: PrismaCompanyMemberWithUser): CompanyMemberEntity {
    const entity = new CompanyMemberEntity();
    entity.id = prisma.id;
    entity.userId = prisma.userId;
    entity.companyId = prisma.companyId;
    if (!Object.values(CompanyRole).includes(prisma.role as CompanyRole)) {
      throw new Error(`Invalid CompanyRole value: ${prisma.role}`);
    }
    entity.role = prisma.role as CompanyRole;
    entity.position = prisma.position;
    entity.branchId = prisma.branchId;
    entity.departmentId = prisma.departmentId;
    entity.canPayInvoices = prisma.canPayInvoices;
    entity.isActive = prisma.isActive;
    entity.lastSeenAt = prisma.lastSeenAt;
    entity.createdAt = prisma.createdAt;
    entity.updatedAt = prisma.updatedAt;
    if (prisma.user) {
      entity.userName = prisma.user.name;
      entity.userEmail = prisma.user.email;
      entity.userPhone = prisma.user.phone;
    }
    return entity;
  }

  static fromCreateParams(
    params: CreateCompanyMemberParams,
  ): CompanyMemberEntity {
    const entity = new CompanyMemberEntity();
    entity.id = "";
    entity.userId = params.userId;
    entity.companyId = params.companyId;
    entity.role = params.role;
    entity.position = params.position ?? null;
    entity.branchId = params.branchId ?? null;
    entity.departmentId = params.departmentId ?? null;
    entity.canPayInvoices = params.canPayInvoices ?? false;
    entity.isActive = params.isActive ?? true;
    entity.lastSeenAt = null;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  toPrismaCreate(): Prisma.CompanyMemberCreateInput {
    return {
      user: { connect: { id: this.userId } },
      company: { connect: { id: this.companyId } },
      role: this.role,
      position: this.position,
      branch: this.branchId
        ? {
            connect: {
              companyId_id: { companyId: this.companyId, id: this.branchId },
            },
          }
        : undefined,
      department: this.departmentId
        ? {
            connect: {
              companyId_id: {
                companyId: this.companyId,
                id: this.departmentId,
              },
            },
          }
        : undefined,
      canPayInvoices: this.canPayInvoices,
      isActive: this.isActive,
    };
  }
}
