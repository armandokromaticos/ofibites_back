import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  assertCanPayInvoice,
  assertCanReadInvoice,
  InvoiceActor,
} from "./invoice-access";
import { CompanyRole } from "../../domain/enums/company-role.enum";
import { Role } from "../../domain/enums/role.enum";
import { invoice, FIXTURE_COMPANY } from "../../testing/invoice-fixtures";

function client(
  role: CompanyRole,
  canPayInvoices = false,
  companyId = FIXTURE_COMPANY,
): InvoiceActor {
  return {
    userId: "user-1",
    role: Role.CLIENT,
    member: { companyId, role, canPayInvoices },
  };
}

const platform = (role: Role): InvoiceActor => ({
  userId: "admin-1",
  role,
  member: null,
});

describe("permisos de facturas (T-06)", () => {
  const inv = invoice();

  it("leer: cualquier miembro de la empresa y la plataforma de facturas", () => {
    expect(() =>
      assertCanReadInvoice(inv, client(CompanyRole.COMPANY_BUYER)),
    ).not.toThrow();
    for (const role of [Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.FINANCE_ADMIN]) {
      expect(() => assertCanReadInvoice(inv, platform(role))).not.toThrow();
    }
  });

  it("factura de otra empresa → 404 (no 403), también al pagar", () => {
    const other = client(CompanyRole.COMPANY_ADMIN, true, "company-2");
    expect(() => assertCanReadInvoice(inv, other)).toThrow(NotFoundException);
    expect(() => assertCanPayInvoice(inv, other)).toThrow(NotFoundException);
  });

  it("OPERATOR sin membresía no la ve (404)", () => {
    expect(() => assertCanReadInvoice(inv, platform(Role.OPERATOR))).toThrow(
      NotFoundException,
    );
  });

  it("inexistente → 404", () => {
    expect(() =>
      assertCanReadInvoice(null, client(CompanyRole.COMPANY_ADMIN)),
    ).toThrow(NotFoundException);
  });

  it("paga COMPANY_ADMIN siempre", () => {
    expect(() =>
      assertCanPayInvoice(inv, client(CompanyRole.COMPANY_ADMIN)),
    ).not.toThrow();
  });

  it("paga cualquier rol con canPayInvoices (COMPANY_FINANCE solo con el flag)", () => {
    expect(() =>
      assertCanPayInvoice(inv, client(CompanyRole.COMPANY_BUYER, true)),
    ).not.toThrow();
    expect(() =>
      assertCanPayInvoice(inv, client(CompanyRole.COMPANY_FINANCE, true)),
    ).not.toThrow();
    expect(() =>
      assertCanPayInvoice(inv, client(CompanyRole.COMPANY_FINANCE)),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertCanPayInvoice(inv, client(CompanyRole.COMPANY_BUYER)),
    ).toThrow(ForbiddenException);
  });

  it("la plataforma no reporta pagos (403)", () => {
    expect(() => assertCanPayInvoice(inv, platform(Role.SUPER_ADMIN))).toThrow(
      ForbiddenException,
    );
  });
});
