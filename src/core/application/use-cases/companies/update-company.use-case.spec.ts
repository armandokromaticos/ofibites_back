import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  FINANCE_ADMIN_ONLY_CREDIT_LIMIT_MESSAGE,
  UpdateCompanyUseCase,
} from "./update-company.use-case";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { UpdateCompanyDto } from "../../dto/companies/update-company.dto";
import { Role } from "../../../domain/enums/role.enum";

function setup() {
  const repo = {
    findUnique: jest.fn(() => Promise.resolve({ id: "company-1" })),
    update: jest.fn(() => Promise.resolve({ id: "company-1" })),
  };
  return {
    repo,
    useCase: new UpdateCompanyUseCase(repo as unknown as ICompanyRepository),
  };
}

const dto = (fields: Partial<UpdateCompanyDto>) => fields as UpdateCompanyDto;

describe("UpdateCompanyUseCase · creditLimit (T-06)", () => {
  it("FINANCE_ADMIN puede cambiar el cupo (y quitarlo con null)", async () => {
    const { useCase, repo } = setup();
    await useCase.execute(
      "company-1",
      dto({ creditLimit: 8000 }),
      Role.FINANCE_ADMIN,
    );
    await useCase.execute(
      "company-1",
      dto({ creditLimit: null }),
      Role.FINANCE_ADMIN,
    );
    expect(repo.update).toHaveBeenNthCalledWith(1, {
      where: { id: "company-1" },
      data: { creditLimit: new Prisma.Decimal(8000) },
    });
    expect(repo.update).toHaveBeenNthCalledWith(2, {
      where: { id: "company-1" },
      data: { creditLimit: null },
    });
  });

  it("FINANCE_ADMIN con cualquier otro campo → 403 en español, sin escribir", async () => {
    const { useCase, repo } = setup();
    for (const fields of [
      { creditDays: 30 },
      { creditLimit: 100, legalName: "Otra" },
      { isActive: false },
    ]) {
      const error: unknown = await useCase
        .execute("company-1", dto(fields), Role.FINANCE_ADMIN)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(
        FINANCE_ADMIN_ONLY_CREDIT_LIMIT_MESSAGE,
      );
    }
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN / OPS_ADMIN cambian cualquier campo junto al cupo", async () => {
    const { useCase, repo } = setup();
    for (const role of [Role.SUPER_ADMIN, Role.OPS_ADMIN]) {
      await useCase.execute(
        "company-1",
        dto({ creditDays: 30, creditLimit: 500 }),
        role,
      );
    }
    expect(repo.update).toHaveBeenCalledTimes(2);
  });
});
