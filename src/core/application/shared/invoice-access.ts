import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CompanyRole } from "../../domain/enums/company-role.enum";
import { Role } from "../../domain/enums/role.enum";
import { InvoiceEntity } from "../../domain/entities/invoice.entity";
import { INVOICE_NOT_FOUND_MESSAGE } from "./invoice-errors";

/** Plataforma que gestiona facturas: valida pagos, sube PDF fiscal y lee todo. */
export const PLATFORM_INVOICE_ROLES: readonly Role[] = [
  Role.SUPER_ADMIN,
  Role.OPS_ADMIN,
  Role.FINANCE_ADMIN,
];

export const ALL_COMPANY_ROLES: readonly CompanyRole[] = [
  CompanyRole.COMPANY_ADMIN,
  CompanyRole.COMPANY_BUYER,
  CompanyRole.COMPANY_FINANCE,
  CompanyRole.COMPANY_APPROVER,
];

/** Lo justo de la membresía que deja `PlatformOrCompanyRoleGuard`. */
export interface InvoiceMember {
  companyId: string;
  role: CompanyRole;
  canPayInvoices: boolean;
}

/** Quién llama a un endpoint de facturas del cliente. */
export interface InvoiceActor {
  userId: string;
  role: Role;
  /** null si pasó por rol de plataforma. */
  member: InvoiceMember | null;
}

export function isPlatformInvoiceRole(role: Role): boolean {
  return PLATFORM_INVOICE_ROLES.includes(role);
}

/**
 * Paga quien sea `COMPANY_ADMIN` o tenga `canPayInvoices` (incluido
 * `COMPANY_FINANCE`, que solo paga con el flag; DECISIONES T-06 respuestas, 10).
 */
export function canPayInvoices(member: {
  role: CompanyRole;
  canPayInvoices: boolean;
}): boolean {
  return member.role === CompanyRole.COMPANY_ADMIN || member.canPayInvoices;
}

/**
 * Lectura de una factura: plataforma de facturas, o miembro activo de la
 * empresa de la factura (la misma regla que leer su pedido). De otra empresa
 * → 404, sin distinguir si existe.
 */
export function assertCanReadInvoice(
  invoice: InvoiceEntity | null,
  actor: InvoiceActor,
): asserts invoice is InvoiceEntity {
  if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  if (isPlatformInvoiceRole(actor.role)) return;
  if (!actor.member || actor.member.companyId !== invoice.companyId) {
    throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  }
}

/** Reportar o cancelar un pago: solo pagadores de la empresa (403 si no). */
export function assertCanPayInvoice(
  invoice: InvoiceEntity | null,
  actor: InvoiceActor,
): asserts invoice is InvoiceEntity {
  if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  if (!actor.member) {
    if (isPlatformInvoiceRole(actor.role)) {
      throw new ForbiddenException(
        "Ofibites no reporta pagos: valida los que reporta el cliente",
      );
    }
    throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (actor.member.companyId !== invoice.companyId) {
    throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  }
  if (!canPayInvoices(actor.member)) {
    throw new ForbiddenException(
      "No tienes permiso para pagar facturas de esta empresa",
    );
  }
}
