import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { isUUID } from "class-validator";
import type { Response } from "express";
import { Role } from "../../../core/domain/enums/role.enum";
import { CompanyRole } from "../../../core/domain/enums/company-role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { CompanyRoleGuard } from "../../auth/guards/company-role.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CompanyRoles } from "../../auth/decorators/company-roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { ClientDashboardResponseDto } from "../../../core/application/dto/dashboard/client-dashboard-response.dto";
import { AdminDashboardResponseDto } from "../../../core/application/dto/dashboard/admin-dashboard-response.dto";
import { DashboardMonthQueryDto } from "../../../core/application/dto/dashboard/dashboard-month-query.dto";
import { BranchBreakdownResponseDto } from "../../../core/application/dto/dashboard/branch-breakdown-response.dto";
import { DepartmentBreakdownResponseDto } from "../../../core/application/dto/dashboard/department-breakdown-response.dto";
import { UserBreakdownResponseDto } from "../../../core/application/dto/dashboard/user-breakdown-response.dto";
import { ExportDashboardQueryDto } from "../../../core/application/dto/dashboard/export-dashboard-query.dto";
import { GetClientDashboardUseCase } from "../../../core/application/use-cases/dashboard/get-client-dashboard.use-case";
import { GetAdminDashboardUseCase } from "../../../core/application/use-cases/dashboard/get-admin-dashboard.use-case";
import { GetClientBranchBreakdownUseCase } from "../../../core/application/use-cases/dashboard/get-client-branch-breakdown.use-case";
import { GetClientDepartmentBreakdownUseCase } from "../../../core/application/use-cases/dashboard/get-client-department-breakdown.use-case";
import { GetClientUserBreakdownUseCase } from "../../../core/application/use-cases/dashboard/get-client-user-breakdown.use-case";
import { ExportClientDashboardUseCase } from "../../../core/application/use-cases/dashboard/export-client-dashboard.use-case";

@ApiTags("Dashboard")
@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard, CompanyRoleGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(
    private readonly getClientDashboardUseCase: GetClientDashboardUseCase,
    private readonly getAdminDashboardUseCase: GetAdminDashboardUseCase,
    private readonly getClientBranchBreakdownUseCase: GetClientBranchBreakdownUseCase,
    private readonly getClientDepartmentBreakdownUseCase: GetClientDepartmentBreakdownUseCase,
    private readonly getClientUserBreakdownUseCase: GetClientUserBreakdownUseCase,
    private readonly exportClientDashboardUseCase: ExportClientDashboardUseCase,
  ) {}

  @Get("client")
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary:
      "Indicadores del cliente (Mi perfil): KPIs del mes, pedidos por día y top productos",
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Si se envía, acota los indicadores a esa empresa (validando acceso del usuario).",
  })
  async getClientDashboard(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: DashboardMonthQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<ClientDashboardResponseDto> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    return this.getClientDashboardUseCase.execute(
      user.id,
      user.role,
      companyId,
      query.month,
    );
  }

  @Get("client/breakdown/branches")
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary: 'Indicadores del cliente: desglose "por sede" del mes',
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Si se envía, acota el desglose a esa empresa (validando acceso del usuario).",
  })
  async getClientBranchBreakdown(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: DashboardMonthQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<BranchBreakdownResponseDto> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    return this.getClientBranchBreakdownUseCase.execute(
      user.id,
      user.role,
      companyId,
      query.month,
    );
  }

  @Get("client/breakdown/departments")
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary: 'Indicadores del cliente: desglose "por departamento" del mes',
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Si se envía, acota el desglose a esa empresa (validando acceso del usuario).",
  })
  async getClientDepartmentBreakdown(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: DashboardMonthQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<DepartmentBreakdownResponseDto> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    return this.getClientDepartmentBreakdownUseCase.execute(
      user.id,
      user.role,
      companyId,
      query.month,
    );
  }

  @Get("client/breakdown/users")
  @Roles(Role.CLIENT)
  @CompanyRoles(CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_FINANCE)
  @ApiOperation({
    summary:
      'Indicadores del cliente: desglose "por usuario" del mes. Solo COMPANY_ADMIN/COMPANY_FINANCE',
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: true,
    description: "Obligatorio: la empresa sobre la que se calcula el desglose.",
  })
  async getClientUserBreakdown(
    @Query() query: DashboardMonthQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<UserBreakdownResponseDto> {
    // CompanyRoleGuard ya exigió el header y el rol; llega siempre presente.
    const companyId = this.parseCompanyIdHeader(companyIdHeader) as string;
    return this.getClientUserBreakdownUseCase.execute(companyId, query.month);
  }

  @Get("client/export")
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary:
      "Indicadores del cliente: exportar CSV (overview, branch, department o user; user solo COMPANY_ADMIN/COMPANY_FINANCE)",
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Opcional para overview/branch/department (igual que el resto de /dashboard/client); obligatorio si view=user.",
  })
  async exportClientDashboard(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: ExportDashboardQueryDto,
    @Headers("x-company-id") companyIdHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    const file = await this.exportClientDashboardUseCase.execute(
      user.id,
      user.role,
      companyId,
      query.view,
      query.month,
    );
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    return file.content;
  }

  @Get("admin")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary:
      "Indicadores operativos de Ofibites: KPIs del día, facturación, recibidos por día, top productos/surtidos/empresas",
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Si se envía, acota los indicadores a esa empresa; si no, abarca todas.",
  })
  async getAdminDashboard(
    @CurrentUser() user: { id: string; role: Role },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<AdminDashboardResponseDto> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    return this.getAdminDashboardUseCase.execute(user.id, user.role, companyId);
  }

  private parseCompanyIdHeader(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!isUUID(trimmed, "4")) {
      throw new BadRequestException("X-Company-Id debe ser un UUID válido");
    }
    return trimmed;
  }
}
