import { Inject, Injectable } from "@nestjs/common";
import type { IDashboardRepository } from "../../../domain/repositories/dashboard.repository.interface";
import { DASHBOARD_REPOSITORY } from "../../../domain/repositories/dashboard.repository.interface";
import { resolveDashboardMonthRange } from "../../shared/dashboard-month.util";
import { UserBreakdownResponseDto } from "../../dto/dashboard/user-breakdown-response.dto";

/**
 * T-32a: "Indicadores" de Mi perfil, desglose por usuario. Restringido a
 * `COMPANY_ADMIN`/`COMPANY_FINANCE` por `CompanyRoleGuard` en el controller
 * (`@CompanyRoles`), que además exige `X-Company-Id` y deja resuelto
 * `companyId`. Por eso este caso de uso no vuelve a resolver visibilidad: el
 * alcance es, siempre, esa única empresa.
 */
@Injectable()
export class GetClientUserBreakdownUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepository: IDashboardRepository,
  ) {}

  async execute(
    companyId: string,
    month?: string,
  ): Promise<UserBreakdownResponseDto> {
    const { monthStart, monthEnd } = resolveDashboardMonthRange(month);
    return this.dashboardRepository.getUserBreakdown(companyId, {
      monthStart,
      monthEnd,
    });
  }
}
