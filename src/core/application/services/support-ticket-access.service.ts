import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../domain/repositories/company-member.repository.interface";
import { SupportTicketEntity } from "../../domain/entities/support-ticket.entity";
import { TicketStatus } from "../../domain/enums/ticket-status.enum";
import { Role } from "../../domain/enums/role.enum";
import { PLATFORM_FULL_ACCESS_ROLES } from "../shared/platform-roles.constants";

export interface SupportTicketListFilters {
  status?: TicketStatus;
  companyId?: string;
}

/**
 * Centraliza el scope de visibilidad de tickets: la plataforma (SUPER_ADMIN /
 * OPS_ADMIN) ve todos; el CLIENT solo los de sus empresas con membresía activa.
 */
@Injectable()
export class SupportTicketAccessService {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  private isPlatform(role: Role): boolean {
    return PLATFORM_FULL_ACCESS_ROLES.has(role);
  }

  /** Construye el `where` del listado según rol + filtros opcionales. */
  async resolveListWhere(
    userId: string,
    userRole: Role,
    filters: SupportTicketListFilters,
  ): Promise<Prisma.SupportTicketWhereInput> {
    const where: Prisma.SupportTicketWhereInput = {};
    if (filters.status) {
      where.status = filters.status;
    }

    if (this.isPlatform(userRole)) {
      if (filters.companyId) {
        where.companyId = filters.companyId;
      }
      return where;
    }

    // CLIENT: acotado a sus empresas activas.
    const companyIds =
      await this.companyMemberRepository.findActiveCompanyIdsByUserId(userId);
    if (filters.companyId) {
      if (!companyIds.includes(filters.companyId)) {
        throw new ForbiddenException("No perteneces a esta empresa");
      }
      where.companyId = filters.companyId;
    } else {
      where.companyId = { in: companyIds };
    }
    return where;
  }

  /** Valida que el usuario pueda leer/responder un ticket concreto. */
  async assertCanAccess(
    ticket: SupportTicketEntity,
    userId: string,
    userRole: Role,
  ): Promise<void> {
    if (this.isPlatform(userRole)) {
      return;
    }
    const member =
      await this.companyMemberRepository.findActiveByUserAndCompany(
        userId,
        ticket.companyId,
      );
    if (!member) {
      throw new ForbiddenException("No tienes acceso a este reporte");
    }
  }
}
