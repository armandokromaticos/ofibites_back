import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { assertCompanyRole } from "./company-role-access";
import { CompanyRole } from "../../domain/enums/company-role.enum";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";

function makeDeps(member: { role: CompanyRole } | null): {
  companyMemberRepository: ICompanyMemberRepository;
} {
  return {
    companyMemberRepository: {
      findActiveByUserAndCompany: jest.fn().mockResolvedValue(member),
    } as unknown as ICompanyMemberRepository,
  };
}

// Restricción de "dimensión usuario" (export CSV, T-32a): solo
// COMPANY_ADMIN/COMPANY_FINANCE. Mismos códigos/mensajes que CompanyRoleGuard.
describe("assertCompanyRole (T-32a)", () => {
  it("400 si no viene X-Company-Id", async () => {
    const deps = makeDeps(null);
    await expect(
      assertCompanyRole("user-1", undefined, [CompanyRole.COMPANY_ADMIN], deps),
    ).rejects.toThrow(BadRequestException);
  });

  it("403 si el usuario no es miembro activo de esa empresa", async () => {
    const deps = makeDeps(null);
    await expect(
      assertCompanyRole(
        "user-1",
        "company-1",
        [CompanyRole.COMPANY_ADMIN],
        deps,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("403 si el rol de empresa no está en la lista permitida (p. ej. COMPANY_BUYER)", async () => {
    const deps = makeDeps({ role: CompanyRole.COMPANY_BUYER });
    await expect(
      assertCompanyRole(
        "user-1",
        "company-1",
        [CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_FINANCE],
        deps,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_FINANCE])(
    "no lanza si el rol es %s",
    async (role) => {
      const deps = makeDeps({ role });
      await expect(
        assertCompanyRole(
          "user-1",
          "company-1",
          [CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_FINANCE],
          deps,
        ),
      ).resolves.toBeUndefined();
    },
  );
});
