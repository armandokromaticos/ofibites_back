import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { DashboardMonthQueryDto } from "./dashboard-month-query.dto";

export enum DashboardExportView {
  OVERVIEW = "overview",
  BRANCH = "branch",
  DEPARTMENT = "department",
  USER = "user",
}

export class ExportDashboardQueryDto extends DashboardMonthQueryDto {
  @ApiProperty({
    enum: DashboardExportView,
    description:
      "Qué columnas exportar: overview (los 4 KPIs), branch/department/user (mismas columnas que su desglose). view=user solo para COMPANY_ADMIN/COMPANY_FINANCE.",
  })
  @IsEnum(DashboardExportView, {
    message: "view solo admite: overview, branch, department, user",
  })
  view: DashboardExportView;
}
