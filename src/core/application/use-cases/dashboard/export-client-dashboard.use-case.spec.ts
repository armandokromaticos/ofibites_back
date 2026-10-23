import { ForbiddenException } from "@nestjs/common";
import { ExportClientDashboardUseCase } from "./export-client-dashboard.use-case";
import { DashboardExportView } from "../../dto/dashboard/export-dashboard-query.dto";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { Role } from "../../../domain/enums/role.enum";
import type { IDashboardRepository } from "../../../domain/repositories/dashboard.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { OrderVisibilityResolver } from "../../services/order-visibility.resolver";

function setup() {
  const dashboardRepository: Partial<jest.Mocked<IDashboardRepository>> = {
    getClientDashboard: jest.fn(),
    getBranchBreakdown: jest.fn(),
    getDepartmentBreakdown: jest.fn(),
    getUserBreakdown: jest.fn(),
  };
  const visibilityResolver = {
    resolve: jest.fn().mockResolvedValue({ type: "all" }),
  } as unknown as OrderVisibilityResolver;
  const companyMemberRepository = {
    findActiveByUserAndCompany: jest.fn(),
  } as unknown as jest.Mocked<ICompanyMemberRepository>;

  const useCase = new ExportClientDashboardUseCase(
    dashboardRepository as IDashboardRepository,
    visibilityResolver,
    companyMemberRepository,
  );

  return {
    useCase,
    dashboardRepository,
    visibilityResolver,
    companyMemberRepository,
  };
}

describe("ExportClientDashboardUseCase (T-32a)", () => {
  it("view=branch: CSV con las columnas de dimension=branch, fila de totales y escape de comas/comillas", async () => {
    const { useCase, dashboardRepository } = setup();
    (dashboardRepository.getBranchBreakdown as jest.Mock).mockResolvedValue({
      rows: [
        {
          branchId: "b1",
          name: 'Sede "Centro", Norte',
          orders: 4,
          dinersServed: 6,
          investment: 400,
          avgTicket: 100,
          changePercent: 100,
        },
      ],
      totals: {
        orders: 4,
        dinersServed: 6,
        investment: 400,
        avgTicket: 100,
        changePercent: 100,
      },
    });

    const file = await useCase.execute(
      "user-1",
      Role.CLIENT,
      "company-1",
      DashboardExportView.BRANCH,
      "2026-10",
    );

    expect(file.filename).toBe("indicadores-sedes-2026-10.csv");
    // El contenido empieza con el BOM UTF-8 (ver abajo); se lo quitamos antes
    // de partir en líneas para comparar el texto tal cual.
    const lines = file.content.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Sede,Pedidos,Comensales,Inversión,Ticket promedio,Variación vs. mes anterior (%)",
    );
    expect(lines[1]).toBe('"Sede ""Centro"", Norte",4,6,400,100,100');
    expect(lines[2]).toBe("Total empresa,4,6,400,100,100");
    // BOM UTF-8 al inicio (Excel + acentos en español).
    expect(file.content.charCodeAt(0)).toBe(0xfeff);
  });

  it("view=user: 403 si el rol de empresa no es COMPANY_ADMIN/COMPANY_FINANCE", async () => {
    const { useCase, companyMemberRepository, dashboardRepository } = setup();
    (
      companyMemberRepository.findActiveByUserAndCompany as jest.Mock
    ).mockResolvedValue({ role: CompanyRole.COMPANY_BUYER });

    await expect(
      useCase.execute(
        "user-1",
        Role.CLIENT,
        "company-1",
        DashboardExportView.USER,
        "2026-10",
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(dashboardRepository.getUserBreakdown).not.toHaveBeenCalled();
  });

  it("view=user: permite a COMPANY_FINANCE y exporta las columnas de dimension=user", async () => {
    const { useCase, companyMemberRepository, dashboardRepository } = setup();
    (
      companyMemberRepository.findActiveByUserAndCompany as jest.Mock
    ).mockResolvedValue({ role: CompanyRole.COMPANY_FINANCE });
    (dashboardRepository.getUserBreakdown as jest.Mock).mockResolvedValue({
      rows: [
        {
          userId: "u1",
          name: "Juan Pérez",
          departmentName: "Ventas",
          branchName: "Sede Centro",
          orders: 2,
          investment: 150,
          lastOrderAt: "2026-10-15T12:00:00.000Z",
        },
      ],
    });

    const file = await useCase.execute(
      "user-1",
      Role.CLIENT,
      "company-1",
      DashboardExportView.USER,
      "2026-10",
    );

    const lines = file.content.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Usuario,Departamento,Sede,Pedidos,Inversión,Último pedido",
    );
    expect(lines[1]).toBe(
      "Juan Pérez,Ventas,Sede Centro,2,150,2026-10-15T12:00:00.000Z",
    );
  });
});
