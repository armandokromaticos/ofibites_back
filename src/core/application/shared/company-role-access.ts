import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";
import { CompanyRole } from "../../domain/enums/company-role.enum";

export interface CompanyRoleAccessDeps {
  companyMemberRepository: ICompanyMemberRepository;
}

/**
 * Exige que el caller sea miembro activo de `companyId` con uno de
 * `allowedRoles`. Mismos mensajes que `CompanyRoleGuard` (400 sin header, 403
 * sin membresía o sin el rol) para que el front los reconozca igual.
 * Usado donde la restricción depende de un valor de query (p. ej.
 * `view=user` del export, T-32a) y por eso no se puede declarar con
 * `@CompanyRoles` a nivel de endpoint.
 */
export async function assertCompanyRole(
  userId: string,
  companyId: string | undefined,
  allowedRoles: readonly CompanyRole[],
  deps: CompanyRoleAccessDeps,
): Promise<void> {
  if (!companyId) {
    throw new BadRequestException(
      "Header X-Company-Id requerido para esta acción",
    );
  }
  const member = await deps.companyMemberRepository.findActiveByUserAndCompany(
    userId,
    companyId,
  );
  if (!member) {
    throw new ForbiddenException("No perteneces a esta empresa");
  }
  if (!allowedRoles.includes(member.role)) {
    throw new ForbiddenException(
      "No tienes permisos en esta empresa para esta acción",
    );
  }
}
