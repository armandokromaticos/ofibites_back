import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DashboardController } from "./controllers/dashboard.controller";
import { DASHBOARD_REPOSITORY } from "../../core/domain/repositories/dashboard.repository.interface";
import { DashboardRepository } from "../../core/infrastructure/repositories/dashboard.repository";
import { OrderVisibilityResolver } from "../../core/application/services/order-visibility.resolver";
import { GetClientDashboardUseCase } from "../../core/application/use-cases/dashboard/get-client-dashboard.use-case";
import { GetAdminDashboardUseCase } from "../../core/application/use-cases/dashboard/get-admin-dashboard.use-case";
import { GetClientBranchBreakdownUseCase } from "../../core/application/use-cases/dashboard/get-client-branch-breakdown.use-case";
import { GetClientDepartmentBreakdownUseCase } from "../../core/application/use-cases/dashboard/get-client-department-breakdown.use-case";
import { GetClientUserBreakdownUseCase } from "../../core/application/use-cases/dashboard/get-client-user-breakdown.use-case";
import { ExportClientDashboardUseCase } from "../../core/application/use-cases/dashboard/export-client-dashboard.use-case";

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    { provide: DASHBOARD_REPOSITORY, useClass: DashboardRepository },
    OrderVisibilityResolver,
    GetClientDashboardUseCase,
    GetAdminDashboardUseCase,
    GetClientBranchBreakdownUseCase,
    GetClientDepartmentBreakdownUseCase,
    GetClientUserBreakdownUseCase,
    ExportClientDashboardUseCase,
  ],
})
export class DashboardModule {}
