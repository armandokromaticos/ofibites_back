import { NotFoundException } from "@nestjs/common";
import { GetCreditLineUseCase } from "./get-credit-line.use-case";
import { CompanyBillingService } from "../../services/company-billing.service";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";

function useCaseFor(company: unknown) {
  return new GetCreditLineUseCase(
    new CompanyBillingService(
      {
        findOpenByCompany: jest.fn(() => Promise.resolve([])),
      } as unknown as IInvoiceRepository,
      {
        findUnique: jest.fn(() => Promise.resolve(company)),
      } as unknown as ICompanyRepository,
    ),
  );
}

describe("GetCreditLineUseCase", () => {
  it("empresa inexistente → 404", async () => {
    await expect(useCaseFor(null).execute("company-x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("contado → null; crédito → línea", async () => {
    await expect(
      useCaseFor({ creditDays: 0, creditLimit: null }).execute("company-1"),
    ).resolves.toBeNull();
    await expect(
      useCaseFor({ creditDays: 30, creditLimit: 500 }).execute("company-1"),
    ).resolves.toMatchObject({ creditLimit: 500, available: 500 });
  });
});
