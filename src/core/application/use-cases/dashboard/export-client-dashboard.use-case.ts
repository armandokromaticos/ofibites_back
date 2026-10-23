import { Inject, Injectable } from "@nestjs/common";
import type {
  BranchBreakdownData,
  ClientDashboardData,
  DepartmentBreakdownData,
  IDashboardRepository,
  UserBreakdownData,
} from "../../../domain/repositories/dashboard.repository.interface";
import { DASHBOARD_REPOSITORY } from "../../../domain/repositories/dashboard.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import { Role } from "../../../domain/enums/role.enum";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { OrderVisibilityResolver } from "../../services/order-visibility.resolver";
import { assertCompanyRole } from "../../shared/company-role-access";
import {
  dashboardMonthKey,
  resolveDashboardMonthRange,
} from "../../shared/dashboard-month.util";
import { buildCsv } from "../../shared/csv-builder.util";
import { DashboardExportView } from "../../dto/dashboard/export-dashboard-query.dto";

// Solo COMPANY_ADMIN/COMPANY_FINANCE pueden exportar la dimensión "usuario"
// (mismo criterio que `GET /dashboard/client/breakdown/users`).
const USER_EXPORT_ROLES = [
  CompanyRole.COMPANY_ADMIN,
  CompanyRole.COMPANY_FINANCE,
] as const;

export interface ExportedDashboardFile {
  content: string;
  filename: string;
}

/**
 * T-32a: "Indicadores" de Mi perfil, exportar CSV. Un solo endpoint con
 * `?view=`, así que la restricción de rol de `view=user` no se puede declarar
 * con `@CompanyRoles` (es estática, no depende de la query) — se refuerza a
 * mano con `assertCompanyRole`, mismos mensajes que `CompanyRoleGuard`.
 */
@Injectable()
export class ExportClientDashboardUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepository: IDashboardRepository,
    private readonly visibilityResolver: OrderVisibilityResolver,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    companyIdFilter: string | undefined,
    view: DashboardExportView,
    month?: string,
  ): Promise<ExportedDashboardFile> {
    const range = resolveDashboardMonthRange(month);
    const monthKey = dashboardMonthKey(range.monthStart);

    if (view === DashboardExportView.USER) {
      await assertCompanyRole(userId, companyIdFilter, USER_EXPORT_ROLES, {
        companyMemberRepository: this.companyMemberRepository,
      });
      const data = await this.dashboardRepository.getUserBreakdown(
        companyIdFilter as string,
        range,
      );
      return {
        content: this.withBom(this.buildUserCsv(data)),
        filename: `indicadores-usuarios-${monthKey}.csv`,
      };
    }

    const visibility = await this.visibilityResolver.resolve(
      userId,
      userRole,
      companyIdFilter,
    );

    if (view === DashboardExportView.BRANCH) {
      const data = await this.dashboardRepository.getBranchBreakdown(
        visibility,
        range,
      );
      return {
        content: this.withBom(this.buildBranchCsv(data)),
        filename: `indicadores-sedes-${monthKey}.csv`,
      };
    }

    if (view === DashboardExportView.DEPARTMENT) {
      const data = await this.dashboardRepository.getDepartmentBreakdown(
        visibility,
        range,
      );
      return {
        content: this.withBom(this.buildDepartmentCsv(data)),
        filename: `indicadores-departamentos-${monthKey}.csv`,
      };
    }

    // DashboardExportView.OVERVIEW
    const data = await this.dashboardRepository.getClientDashboard(
      visibility,
      range,
    );
    return {
      content: this.withBom(this.buildOverviewCsv(data)),
      filename: `indicadores-resumen-${monthKey}.csv`,
    };
  }

  private buildOverviewCsv(data: ClientDashboardData): string {
    return buildCsv([
      [
        "Pedidos totales",
        "Pedidos en curso",
        "Comensales atendidos",
        "Inversión del mes",
        "Variación vs. mes anterior (%)",
      ],
      [
        data.totalOrders,
        data.inProgressOrders,
        data.dinersServed,
        data.monthInvestment,
        data.monthInvestmentChangePercent,
      ],
    ]);
  }

  private buildBranchCsv(data: BranchBreakdownData): string {
    const header = [
      "Sede",
      "Pedidos",
      "Comensales",
      "Inversión",
      "Ticket promedio",
      "Variación vs. mes anterior (%)",
    ];
    const rows = data.rows.map((row) => [
      row.name,
      row.orders,
      row.dinersServed,
      row.investment,
      row.avgTicket,
      row.changePercent,
    ]);
    const totalsRow = [
      "Total empresa",
      data.totals.orders,
      data.totals.dinersServed,
      data.totals.investment,
      data.totals.avgTicket,
      data.totals.changePercent,
    ];
    return buildCsv([header, ...rows, totalsRow]);
  }

  private buildDepartmentCsv(data: DepartmentBreakdownData): string {
    const header = [
      "Departamento",
      "Sede principal",
      "Pedidos",
      "Comensales",
      "Inversión",
      "% del total",
    ];
    const rows = data.rows.map((row) => [
      row.name,
      row.mainBranchName,
      row.orders,
      row.dinersServed,
      row.investment,
      row.percentOfTotal,
    ]);
    const totalsRow = [
      "Total empresa",
      null,
      data.totals.orders,
      data.totals.dinersServed,
      data.totals.investment,
      data.totals.percentOfTotal,
    ];
    return buildCsv([header, ...rows, totalsRow]);
  }

  private buildUserCsv(data: UserBreakdownData): string {
    const header = [
      "Usuario",
      "Departamento",
      "Sede",
      "Pedidos",
      "Inversión",
      "Último pedido",
    ];
    const rows = data.rows.map((row) => [
      row.name,
      row.departmentName,
      row.branchName,
      row.orders,
      row.investment,
      row.lastOrderAt,
    ]);
    return buildCsv([header, ...rows]);
  }

  /** BOM UTF-8: sin él, Excel rompe los acentos del CSV en español. */
  private withBom(csv: string): string {
    return `${String.fromCharCode(0xfeff)}${csv}`;
  }
}
