import { InvoiceStatus } from "../enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../enums/invoice-payment-record-status.enum";
import { InvoicePaymentStatus } from "../enums/invoice-payment-status.enum";
import {
  caracasDateKeyPlusDays,
  toCaracasDateKey,
} from "../../application/shared/caracas-time.util";

/**
 * Reglas puras de facturas y pagos (T-06). Todas las fechas de negocio en hora
 * de Caracas; las columnas `@db.Date` (`dueDate`, `paymentDate`,
 * `Order.deliveryDate`) son medianoche UTC de la fecha de Caracas.
 */

/** El carrito avisa desde 3 días antes del vencimiento (0–3 días). */
export const INVOICE_DUE_SOON_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `F-AAAA-NNNN` (5 dígitos o más pasado 9999), como `OF-AAAA-NNNN`. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Secuencial de factura inválido: ${sequence}`);
  }
  return `F-${year}-${String(sequence).padStart(4, "0")}`;
}

/** "YYYY-MM-DD" → medianoche UTC de esa fecha (valor de una columna `@db.Date`). */
export function utcMidnightOf(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Fecha pura de una columna `@db.Date` (sus componentes UTC). */
export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DueDateInput {
  creditDays: number;
  /** `Order.deliveryDate` (medianoche UTC) o null. */
  deliveryDate: Date | null;
  issuedAt: Date;
}

/**
 * Vencimiento (DECISIONES T-06 respuestas, 5): contado (`creditDays` 0) →
 * el día de entrega del pedido (si no tiene, el día de emisión en Caracas);
 * crédito → día de emisión en Caracas + `creditDays`.
 */
export function computeInvoiceDueDate(input: DueDateInput): Date {
  if (input.creditDays <= 0) {
    return input.deliveryDate
      ? utcMidnightOf(dateKeyOf(input.deliveryDate))
      : utcMidnightOf(toCaracasDateKey(input.issuedAt));
  }
  return utcMidnightOf(
    caracasDateKeyPlusDays(input.creditDays, input.issuedAt),
  );
}

/** Días entre hoy (Caracas) y `dueDate`: 0 = vence hoy, negativo = vencida. */
export function daysUntilDue(dueDate: Date, now: Date = new Date()): number {
  const today = utcMidnightOf(toCaracasDateKey(now)).getTime();
  const due = utcMidnightOf(dateKeyOf(dueDate)).getTime();
  return Math.round((due - today) / MS_PER_DAY);
}

/** Vencida = sin pagar (`PENDING`) y `dueDate` anterior a hoy en Caracas. */
export function isInvoiceOverdue(
  invoice: { status: InvoiceStatus; dueDate: Date },
  now: Date = new Date(),
): boolean {
  return (
    invoice.status === InvoiceStatus.PENDING &&
    daysUntilDue(invoice.dueDate, now) < 0
  );
}

export interface PaymentStatusInput {
  status: InvoiceStatus;
  dueDate: Date;
  /** Estado del registro de pago más reciente, o null si no hay. */
  latestPaymentStatus: InvoicePaymentRecordStatus | null;
  /** Hay un comprobante `PENDING_REVIEW` (como mucho uno). */
  hasPendingReview: boolean;
}

/**
 * Estado de pago para el chip. Precedencia: PAID · VOID · IN_REVIEW ·
 * OVERDUE · REJECTED · PENDING.
 */
export function derivePaymentStatus(
  input: PaymentStatusInput,
  now: Date = new Date(),
): InvoicePaymentStatus {
  if (input.status === InvoiceStatus.PAID) return InvoicePaymentStatus.PAID;
  if (input.status === InvoiceStatus.VOID) return InvoicePaymentStatus.VOID;
  if (input.hasPendingReview) return InvoicePaymentStatus.IN_REVIEW;
  if (isInvoiceOverdue(input, now)) return InvoicePaymentStatus.OVERDUE;
  if (input.latestPaymentStatus === InvoicePaymentRecordStatus.REJECTED) {
    return InvoicePaymentStatus.REJECTED;
  }
  return InvoicePaymentStatus.PENDING;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Saldo = total − pagado (nunca negativo), en unidades. */
export function invoiceBalance(total: number, amountPaid: number): number {
  return fromCents(Math.max(0, toCents(total) - toCents(amountPaid)));
}

/**
 * Pagos parciales (DECISIONES T-06 respuestas, 2): suma el pago aprobado y
 * decide si la factura queda saldada.
 */
export function applyApprovedPayment(
  total: number,
  amountPaid: number,
  amount: number,
): { amountPaid: number; isPaid: boolean } {
  const paidCents = toCents(amountPaid) + toCents(amount);
  return {
    amountPaid: fromCents(paidCents),
    isPaid: paidCents >= toCents(total),
  };
}

/** Factura abierta (`PENDING`) tal como la necesitan el aviso y el cupo. */
export interface OpenInvoiceSnapshot {
  id: string;
  orderId: string;
  invoiceNumber: string;
  orderNumber: string | null;
  total: number;
  amountPaid: number;
  dueDate: Date;
  hasPendingReview: boolean;
  latestPaymentStatus: InvoicePaymentRecordStatus | null;
}

export type InvoiceAlertLevel = "OVERDUE" | "DUE_SOON";

export interface InvoiceAlert {
  level: InvoiceAlertLevel;
  blocksCheckout: boolean;
  count: number;
  invoice: {
    id: string;
    orderId: string;
    invoiceNumber: string;
    orderNumber: string | null;
    balance: number;
    dueDate: Date;
    daysUntilDue: number;
    paymentStatus: InvoicePaymentStatus;
  };
}

function byDueDateAsc(a: OpenInvoiceSnapshot, b: OpenInvoiceSnapshot): number {
  return a.dueDate.getTime() - b.dueDate.getTime();
}

/** Facturas vencidas, la más antigua primero. */
export function overdueInvoices(
  open: OpenInvoiceSnapshot[],
  now: Date = new Date(),
): OpenInvoiceSnapshot[] {
  return open
    .filter((invoice) => daysUntilDue(invoice.dueDate, now) < 0)
    .sort(byDueDateAsc);
}

/**
 * Aviso del carrito: `OVERDUE` si hay alguna vencida (la más antigua);
 * si no, `DUE_SOON` si alguna vence en 0–3 días (la más próxima); si no, null.
 */
export function computeInvoiceAlert(
  open: OpenInvoiceSnapshot[],
  now: Date = new Date(),
): InvoiceAlert | null {
  const overdue = overdueInvoices(open, now);
  const dueSoon = open
    .filter((invoice) => {
      const days = daysUntilDue(invoice.dueDate, now);
      return days >= 0 && days <= INVOICE_DUE_SOON_DAYS;
    })
    .sort(byDueDateAsc);

  const level: InvoiceAlertLevel | null =
    overdue.length > 0 ? "OVERDUE" : dueSoon.length > 0 ? "DUE_SOON" : null;
  if (!level) return null;
  const list = level === "OVERDUE" ? overdue : dueSoon;
  const first = list[0];
  return {
    level,
    blocksCheckout: level === "OVERDUE",
    count: list.length,
    invoice: {
      id: first.id,
      orderId: first.orderId,
      invoiceNumber: first.invoiceNumber,
      orderNumber: first.orderNumber,
      balance: invoiceBalance(first.total, first.amountPaid),
      dueDate: first.dueDate,
      daysUntilDue: daysUntilDue(first.dueDate, now),
      paymentStatus: derivePaymentStatus(
        {
          status: InvoiceStatus.PENDING,
          dueDate: first.dueDate,
          latestPaymentStatus: first.latestPaymentStatus,
          hasPendingReview: first.hasPendingReview,
        },
        now,
      ),
    },
  };
}

export interface CreditLine {
  creditDays: number;
  creditLimit: number | null;
  committed: number;
  available: number | null;
  isBlocked: boolean;
}

/**
 * Línea de crédito (DECISIONES T-06 respuestas, 11). null si la empresa es de
 * contado. `committed` = saldo de las facturas abiertas; `available` =
 * max(0, cupo − comprometido), o null sin tope; `isBlocked` = alguna vencida.
 */
export function computeCreditLine(
  company: { creditDays: number; creditLimit: number | null },
  open: OpenInvoiceSnapshot[],
  now: Date = new Date(),
): CreditLine | null {
  if (company.creditDays <= 0) return null;
  const committedCents = open.reduce(
    (sum, invoice) =>
      sum + toCents(invoiceBalance(invoice.total, invoice.amountPaid)),
    0,
  );
  const available =
    company.creditLimit === null
      ? null
      : fromCents(Math.max(0, toCents(company.creditLimit) - committedCents));
  return {
    creditDays: company.creditDays,
    creditLimit: company.creditLimit,
    committed: fromCents(committedCents),
    available,
    isBlocked: overdueInvoices(open, now).length > 0,
  };
}

/** El total de un pedido nuevo supera el disponible (solo crédito con tope). */
export function exceedsCreditLine(
  line: CreditLine | null,
  total: number,
): boolean {
  if (!line || line.available === null) return false;
  return toCents(total) > toCents(line.available);
}
