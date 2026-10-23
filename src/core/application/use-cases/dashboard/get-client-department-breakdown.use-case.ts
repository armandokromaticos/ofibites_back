import { Inject, Injectable } from "@nestjs/common";
import type { IDashboardRepository } from "../../../domain/repositories/dashboard.repository.interface";
import { DASHBOARD_REPOSITORY } from "../../../domain/repositories/dashboard.repository.interface";
import { Role } from "../../../domain/enums/role.enum";
import { OrderVisibilityResolver } from "../../services/order-visibility.resolver";
import { resolveDashboardMonthRange } from "../../shared/dashboard-month.util";
import { DepartmentBreakdownResponseDto } from "../../dto/dashboard/department-breakdown-response.dto";

/** T-32a: "Indicadores" de Mi perfil, desglose por departamento. Abierto a
 * cualquier miembro activo de la empresa (mismo nivel que `GET /dashboard/client`). */
@Injectable()
export class GetClientDepartmentBreakdownUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepository: IDashboardRepository,
    private readonly visibilityResolver: OrderVisibilityResolver,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    companyIdFilter?: string,
    month?: string,
  ): Promise<DepartmentBreakdownResponseDto> {
    const visibility = await this.visibilityResolver.resolve(
      userId,
      userRole,
      companyIdFilter,
    );
    const { monthStart, monthEnd } = resolveDashboardMonthRange(month);
    return this.dashboardRepository.getDepartmentBreakdown(visibility, {
      monthStart,
      monthEnd,
    });
  }
}
