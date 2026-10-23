import { Inject, Injectable } from "@nestjs/common";
import type { IDashboardRepository } from "../../../domain/repositories/dashboard.repository.interface";
import { DASHBOARD_REPOSITORY } from "../../../domain/repositories/dashboard.repository.interface";
import { Role } from "../../../domain/enums/role.enum";
import { OrderVisibilityResolver } from "../../services/order-visibility.resolver";
import { resolveDashboardMonthRange } from "../../shared/dashboard-month.util";
import { BranchBreakdownResponseDto } from "../../dto/dashboard/branch-breakdown-response.dto";

/** T-32a: "Indicadores" de Mi perfil, desglose por sede. Abierto a cualquier
 * miembro activo de la empresa (mismo nivel que `GET /dashboard/client`). */
@Injectable()
export class GetClientBranchBreakdownUseCase {
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
  ): Promise<BranchBreakdownResponseDto> {
    const visibility = await this.visibilityResolver.resolve(
      userId,
      userRole,
      companyIdFilter,
    );
    const range = resolveDashboardMonthRange(month);
    return this.dashboardRepository.getBranchBreakdown(visibility, range);
  }
}
