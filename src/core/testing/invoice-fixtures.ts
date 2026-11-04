// Fixtures de facturas para los specs (T-06). Excluido del build
// (tsconfig.build.json → "src/core/testing").
import { Prisma } from "@prisma/client";
import {
  InvoiceEntity,
  PrismaInvoicePaymentRow,
  PrismaInvoiceRow,
} from "../domain/entities/invoice.entity";
import { InvoiceStatus } from "../domain/enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../domain/enums/invoice-payment-record-status.enum";
import { PaymentMethod } from "../domain/enums/payment-method.enum";

export const FIXTURE_COMPANY = "company-1";

type PaymentOverrides = Partial<
  Omit<PrismaInvoicePaymentRow, "amount"> & { amount: number }
>;

export function paymentRow(
  overrides: PaymentOverrides = {},
): PrismaInvoicePaymentRow {
  const { amount, ...rest } = overrides;
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    status: InvoicePaymentRecordStatus.PENDING_REVIEW,
    method: PaymentMethod.MOBILE_PAYMENT,
    bank: null,
    reference: "0102-88431",
    amount: new Prisma.Decimal(amount ?? 100),
    paymentDate: new Date("2026-10-15T00:00:00.000Z"),
    proofPath: "company-1/inv-1/proof.jpg",
    proofFileName: "comprobante.jpg",
    proofMimeType: "image/jpeg",
    proofSizeBytes: 1000,
    submittedById: "user-1",
    submittedAt: new Date("2026-10-15T14:00:00.000Z"),
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    withdrawnAt: null,
    submittedBy: { id: "user-1", name: "María Pérez" },
    ...rest,
  };
}

type InvoiceOverrides = Partial<
  Omit<PrismaInvoiceRow, "total" | "amountPaid"> & {
    total: number;
    amountPaid: number;
  }
>;

export function invoiceRow(overrides: InvoiceOverrides = {}): PrismaInvoiceRow {
  const { total, amountPaid, ...rest } = overrides;
  const totalDecimal = new Prisma.Decimal(total ?? 116);
  return {
    id: "inv-1",
    invoiceNumber: "F-2026-0001",
    orderId: "order-1",
    companyId: FIXTURE_COMPANY,
    status: InvoiceStatus.PENDING,
    issuedAt: new Date("2026-10-10T14:00:00.000Z"),
    dueDate: new Date("2026-11-09T00:00:00.000Z"),
    creditDays: 30,
    subtotal: new Prisma.Decimal(100),
    discount: new Prisma.Decimal(0),
    tax: new Prisma.Decimal(16),
    shipping: new Prisma.Decimal(0),
    total: totalDecimal,
    amountPaid: new Prisma.Decimal(amountPaid ?? 0),
    paidAt: null,
    voidedAt: null,
    billingName: "Andina, C.A.",
    billingTaxId: "J-00000000-0",
    billingAddress: "Caracas",
    fiscalPdfPath: null,
    fiscalNumber: null,
    fiscalPdfUploadedAt: null,
    fiscalPdfUploadedById: null,
    createdAt: new Date("2026-10-10T14:00:00.000Z"),
    updatedAt: new Date("2026-10-10T14:00:00.000Z"),
    payments: [],
    order: { orderNumber: "OF-2026-0001" },
    company: { legalName: "Andina, C.A." },
    ...rest,
  };
}

export function invoice(overrides: InvoiceOverrides = {}): InvoiceEntity {
  return InvoiceEntity.fromPrisma(invoiceRow(overrides));
}
