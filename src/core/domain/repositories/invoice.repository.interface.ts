import { Prisma } from "@prisma/client";
import { InvoiceEntity, InvoicePaymentInfo } from "../entities/invoice.entity";
import { InvoicePaymentStatus } from "../enums/invoice-payment-status.enum";
import { PaymentMethod } from "../enums/payment-method.enum";

export const INVOICE_REPOSITORY = Symbol("INVOICE_REPOSITORY");

export const INVOICE_PAYMENT_INCLUDE = {
  submittedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.InvoicePaymentInclude;

const PAYMENTS_NEWEST_FIRST = [
  { submittedAt: "desc" },
  { id: "desc" },
] as const satisfies Prisma.InvoicePaymentOrderByWithRelationInput[];

/** Factura con todos sus pagos, número del pedido y nombre de la empresa. */
export const INVOICE_FULL_INCLUDE = {
  payments: {
    include: INVOICE_PAYMENT_INCLUDE,
    orderBy: [...PAYMENTS_NEWEST_FIRST],
  },
  order: { select: { orderNumber: true } },
  company: { select: { legalName: true } },
} as const satisfies Prisma.InvoiceInclude;

/**
 * Resumen para `OrderResponseDto.invoice`: solo el último pago. Basta para el
 * estado derivado porque como mucho hay un `PENDING_REVIEW` y, mientras
 * existe, no se puede crear otro más reciente (salvo sustituyéndolo).
 */
export const INVOICE_SUMMARY_INCLUDE = {
  payments: {
    include: INVOICE_PAYMENT_INCLUDE,
    orderBy: [...PAYMENTS_NEWEST_FIRST],
    take: 1,
  },
} as const satisfies Prisma.InvoiceInclude;

export interface InvoiceListFilters {
  paymentStatus?: InvoicePaymentStatus;
  companyId?: string;
  overdue?: boolean;
  skip: number;
  take: number;
  now: Date;
}

export interface CreateInvoicePaymentData {
  invoiceId: string;
  method: PaymentMethod;
  bank: string | null;
  reference: string;
  amount: number;
  /** Medianoche UTC de la fecha del pago. */
  paymentDate: Date;
  proofPath: string;
  proofFileName: string;
  proofMimeType: string;
  proofSizeBytes: number;
  submittedById: string;
  /** Pago `PENDING_REVIEW` que se sustituye en la misma transacción. */
  replacesPaymentId?: string;
}

export interface FiscalPdfChange {
  invoice: InvoiceEntity;
  /** Ruta del PDF fiscal anterior (para borrarlo de Storage), si había. */
  previousPath: string | null;
}

/** Datos del pedido para imprimir la proforma. */
export interface InvoiceDocumentData {
  orderNumber: string | null;
  deliveryDate: Date | null;
  /** Quien hizo el pedido ("Att:"). */
  requesterName: string | null;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

export interface PaymentReview {
  invoice: InvoiceEntity;
  payment: InvoicePaymentInfo;
}

/**
 * Las escrituras van en transacción con la fila de la factura bloqueada
 * (`SELECT … FOR UPDATE`) y lanzan `InvoiceRuleException` si la regla no se
 * cumple con los datos frescos (no se escribe nada).
 */
export interface IInvoiceRepository {
  /** Con `INVOICE_FULL_INCLUDE`. */
  findById(id: string): Promise<InvoiceEntity | null>;
  /** Facturas `PENDING` de la empresa (aviso del carrito, cupo, checkout). */
  findOpenByCompany(companyId: string): Promise<InvoiceEntity[]>;
  /** Cola de Ofibites, con `INVOICE_FULL_INCLUDE`. */
  findMany(
    filters: InvoiceListFilters,
  ): Promise<{ data: InvoiceEntity[]; total: number }>;
  createPayment(data: CreateInvoicePaymentData): Promise<InvoiceEntity>;
  withdrawPayment(invoiceId: string, paymentId: string): Promise<InvoiceEntity>;
  approvePayment(
    invoiceId: string,
    paymentId: string,
    reviewerId: string,
    now: Date,
  ): Promise<PaymentReview>;
  rejectPayment(
    invoiceId: string,
    paymentId: string,
    reviewerId: string,
    reason: string,
    now: Date,
  ): Promise<PaymentReview>;
  setFiscalPdf(
    invoiceId: string,
    data: { path: string; fiscalNumber: string | null; uploadedById: string },
  ): Promise<FiscalPdfChange>;
  clearFiscalPdf(invoiceId: string): Promise<FiscalPdfChange>;
  findDocumentData(orderId: string): Promise<InvoiceDocumentData>;
}
