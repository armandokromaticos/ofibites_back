import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  CreateInvoicePaymentData,
  FiscalPdfChange,
  IInvoiceRepository,
  INVOICE_FULL_INCLUDE,
  INVOICE_PAYMENT_INCLUDE,
  INVOICE_SUMMARY_INCLUDE,
  InvoiceDocumentData,
  InvoiceListFilters,
  PaymentReview,
} from "../../domain/repositories/invoice.repository.interface";
import {
  InvoiceEntity,
  invoicePaymentFromPrisma,
} from "../../domain/entities/invoice.entity";
import { InvoiceStatus } from "../../domain/enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../../domain/enums/invoice-payment-record-status.enum";
import { InvoicePaymentStatus } from "../../domain/enums/invoice-payment-status.enum";
import { InvoiceRuleException } from "../../domain/exceptions/invoice-rule.exception";
import {
  applyApprovedPayment,
  computeInvoiceDueDate,
  formatInvoiceNumber,
  invoiceBalance,
  toCents,
  utcMidnightOf,
} from "../../domain/services/invoice-rules";
import {
  caracasYear,
  toCaracasDateKey,
} from "../../application/shared/caracas-time.util";

const TX_OPTIONS = { timeout: 15000 } as const;

/** Siguiente `invoiceNumber` del año de Caracas (mismo patrón que `nextOrderNumber`). */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = caracasYear(now);
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO "invoice_number_counters" ("year", "last_value")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
    SET "last_value" = "invoice_number_counters"."last_value" + 1
    RETURNING "last_value"`;
  return formatInvoiceNumber(year, Number(rows[0].last_value));
}

/** Bloquea la fila de la factura hasta el fin de la transacción. */
async function lockInvoice(
  tx: Prisma.TransactionClient,
  where: { id: string } | { orderId: string },
): Promise<string | null> {
  const rows =
    "id" in where
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "invoices" WHERE "id" = ${where.id} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "invoices" WHERE "order_id" = ${where.orderId} FOR UPDATE`;
  return rows[0]?.id ?? null;
}

/**
 * Emite la factura del pedido dentro de `tx` (al pasar a CONFIRMED y en el
 * backfill): foto de importes y datos fiscales, `creditDays` actual de la
 * empresa y vencimiento por `computeInvoiceDueDate`. Idempotente: si el
 * pedido ya tiene factura no hace nada y devuelve null.
 */
export async function issueInvoiceWithin(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const existing = await tx.invoice.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existing) return null;

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      companyId: true,
      deliveryDate: true,
      subtotal: true,
      discount: true,
      tax: true,
      shipping: true,
      total: true,
      company: {
        select: {
          creditDays: true,
          legalName: true,
          fiscalName: true,
          taxId: true,
          fiscalAddress: true,
        },
      },
    },
  });
  const invoiceNumber = await nextInvoiceNumber(tx, now);
  // Un pedido sin importe (100 % de descuento, cortesía) no tiene nada que
  // cobrar: la factura nace saldada y no bloquea ni consume cupo.
  const nothingToPay = Number(order.total) <= 0;
  const created = await tx.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      companyId: order.companyId,
      status: nothingToPay ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
      paidAt: nothingToPay ? now : null,
      issuedAt: now,
      dueDate: computeInvoiceDueDate({
        creditDays: order.company.creditDays,
        deliveryDate: order.deliveryDate,
        issuedAt: now,
      }),
      creditDays: order.company.creditDays,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      billingName: order.company.fiscalName?.trim() || order.company.legalName,
      billingTaxId: order.company.taxId,
      billingAddress: order.company.fiscalAddress,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Pedido que pasa a CANCELLED (DECISIONES T-06 respuestas, 6): con algún pago
 * aprobado lanza `ORDER_HAS_APPROVED_PAYMENTS` (la transacción se revierte);
 * si no, anula la factura y retira el comprobante en revisión. La fila de la
 * factura queda bloqueada, igual que al aprobar un pago, así que cancelar y
 * aprobar a la vez no pueden pasar los dos.
 */
export async function voidInvoiceForCancellationWithin(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date = new Date(),
): Promise<void> {
  const invoiceId = await lockInvoice(tx, { orderId });
  if (!invoiceId) return;
  const approved = await tx.invoicePayment.count({
    where: { invoiceId, status: InvoicePaymentRecordStatus.APPROVED },
  });
  if (approved > 0) {
    throw new InvoiceRuleException("ORDER_HAS_APPROVED_PAYMENTS");
  }
  await tx.invoicePayment.updateMany({
    where: { invoiceId, status: InvoicePaymentRecordStatus.PENDING_REVIEW },
    data: { status: InvoicePaymentRecordStatus.WITHDRAWN, withdrawnAt: now },
  });
  await tx.invoice.updateMany({
    where: { id: invoiceId, status: InvoiceStatus.PENDING },
    data: { status: InvoiceStatus.VOID, voidedAt: now },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Estado guardado que corresponde a cada estado derivado (para el `where`). */
function storedStatusFor(status: InvoicePaymentStatus): InvoiceStatus {
  if (status === InvoicePaymentStatus.PAID) return InvoiceStatus.PAID;
  if (status === InvoicePaymentStatus.VOID) return InvoiceStatus.VOID;
  return InvoiceStatus.PENDING;
}

@Injectable()
export class InvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InvoiceEntity | null> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_FULL_INCLUDE,
    });
    return row ? InvoiceEntity.fromPrisma(row) : null;
  }

  async findOpenByCompany(companyId: string): Promise<InvoiceEntity[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { companyId, status: InvoiceStatus.PENDING },
      include: {
        ...INVOICE_SUMMARY_INCLUDE,
        order: { select: { orderNumber: true } },
      },
      orderBy: [{ dueDate: "asc" }, { issuedAt: "asc" }],
    });
    return rows.map((row) => InvoiceEntity.fromPrisma(row));
  }

  /**
   * Por columnas (empresa, estado guardado, vencida) se filtra y pagina en BD.
   * Solo los estados derivados sobre facturas `PENDING` (IN_REVIEW, OVERDUE,
   * REJECTED, PENDING) se resuelven en memoria antes de paginar: dependen del
   * último pago y es una cola interna con pocas facturas abiertas.
   */
  async findMany(
    filters: InvoiceListFilters,
  ): Promise<{ data: InvoiceEntity[]; total: number }> {
    const today = utcMidnightOf(toCaracasDateKey(filters.now));
    const and: Prisma.InvoiceWhereInput[] = [];
    if (filters.companyId) and.push({ companyId: filters.companyId });
    if (filters.paymentStatus) {
      and.push({ status: storedStatusFor(filters.paymentStatus) });
    }
    if (filters.overdue === true) {
      and.push({ status: InvoiceStatus.PENDING, dueDate: { lt: today } });
    } else if (filters.overdue === false) {
      and.push({
        NOT: { status: InvoiceStatus.PENDING, dueDate: { lt: today } },
      });
    }
    const where: Prisma.InvoiceWhereInput = { AND: and };
    const orderBy = [
      { issuedAt: "desc" },
      { id: "desc" },
    ] as const satisfies Prisma.InvoiceOrderByWithRelationInput[];

    const derived =
      filters.paymentStatus !== undefined &&
      filters.paymentStatus !== InvoicePaymentStatus.PAID &&
      filters.paymentStatus !== InvoicePaymentStatus.VOID;

    if (!derived) {
      const [rows, total] = await Promise.all([
        this.prisma.invoice.findMany({
          where,
          include: INVOICE_FULL_INCLUDE,
          orderBy: [...orderBy],
          skip: filters.skip,
          take: filters.take,
        }),
        this.prisma.invoice.count({ where }),
      ]);
      return { data: rows.map((row) => InvoiceEntity.fromPrisma(row)), total };
    }

    const rows = await this.prisma.invoice.findMany({
      where,
      include: INVOICE_FULL_INCLUDE,
      orderBy: [...orderBy],
    });
    const data = rows
      .map((row) => InvoiceEntity.fromPrisma(row))
      .filter(
        (invoice) =>
          invoice.paymentStatus(filters.now) === filters.paymentStatus,
      );
    if (filters.paymentStatus === InvoicePaymentStatus.IN_REVIEW) {
      // El más antiguo primero: es el que más lleva esperando.
      data.sort(
        (a, b) =>
          (a.pendingPayment?.submittedAt.getTime() ?? 0) -
          (b.pendingPayment?.submittedAt.getTime() ?? 0),
      );
    }
    return {
      data: data.slice(filters.skip, filters.skip + filters.take),
      total: data.length,
    };
  }

  async createPayment(data: CreateInvoicePaymentData): Promise<InvoiceEntity> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockInvoice(tx, { id: data.invoiceId });
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: data.invoiceId },
          select: { status: true, total: true, amountPaid: true },
        });
        if ((invoice.status as InvoiceStatus) !== InvoiceStatus.PENDING) {
          throw new InvoiceRuleException("INVOICE_NOT_PAYABLE");
        }
        const balance = invoiceBalance(
          Number(invoice.total),
          Number(invoice.amountPaid),
        );
        if (toCents(data.amount) > toCents(balance)) {
          throw new InvoiceRuleException("PAYMENT_AMOUNT_EXCEEDS_BALANCE", {
            balance,
          });
        }
        if (data.replacesPaymentId) {
          const replaced = await tx.invoicePayment.updateMany({
            where: {
              id: data.replacesPaymentId,
              invoiceId: data.invoiceId,
              status: InvoicePaymentRecordStatus.PENDING_REVIEW,
            },
            data: {
              status: InvoicePaymentRecordStatus.WITHDRAWN,
              withdrawnAt: new Date(),
            },
          });
          if (replaced.count !== 1) {
            throw new InvoiceRuleException("PAYMENT_NOT_PENDING");
          }
        } else {
          const pending = await tx.invoicePayment.count({
            where: {
              invoiceId: data.invoiceId,
              status: InvoicePaymentRecordStatus.PENDING_REVIEW,
            },
          });
          if (pending > 0) {
            throw new InvoiceRuleException("PAYMENT_ALREADY_PENDING");
          }
        }
        await tx.invoicePayment.create({
          data: {
            invoiceId: data.invoiceId,
            method: data.method,
            bank: data.bank,
            reference: data.reference,
            amount: new Prisma.Decimal(data.amount),
            paymentDate: data.paymentDate,
            proofPath: data.proofPath,
            proofFileName: data.proofFileName,
            proofMimeType: data.proofMimeType,
            proofSizeBytes: data.proofSizeBytes,
            submittedById: data.submittedById,
          },
        });
      }, TX_OPTIONS);
    } catch (error) {
      // Índice parcial invoice_payments_one_pending: otra petición ganó la carrera.
      if (isUniqueViolation(error)) {
        throw new InvoiceRuleException("PAYMENT_ALREADY_PENDING");
      }
      throw error;
    }
    return this.mustFind(data.invoiceId);
  }

  async withdrawPayment(
    invoiceId: string,
    paymentId: string,
  ): Promise<InvoiceEntity> {
    const result = await this.prisma.invoicePayment.updateMany({
      where: {
        id: paymentId,
        invoiceId,
        status: InvoicePaymentRecordStatus.PENDING_REVIEW,
      },
      data: {
        status: InvoicePaymentRecordStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      },
    });
    if (result.count !== 1) {
      throw new InvoiceRuleException("PAYMENT_NOT_PENDING");
    }
    return this.mustFind(invoiceId);
  }

  async approvePayment(
    invoiceId: string,
    paymentId: string,
    reviewerId: string,
    now: Date,
  ): Promise<PaymentReview> {
    const paymentRow = await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, { id: invoiceId });
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        select: { status: true, total: true, amountPaid: true },
      });
      if ((invoice.status as InvoiceStatus) !== InvoiceStatus.PENDING) {
        throw new InvoiceRuleException("INVOICE_NOT_PAYABLE");
      }
      const updated = await tx.invoicePayment.updateMany({
        where: {
          id: paymentId,
          invoiceId,
          status: InvoicePaymentRecordStatus.PENDING_REVIEW,
        },
        data: {
          status: InvoicePaymentRecordStatus.APPROVED,
          reviewedById: reviewerId,
          reviewedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new InvoiceRuleException("PAYMENT_NOT_PENDING");
      }
      const payment = await tx.invoicePayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: INVOICE_PAYMENT_INCLUDE,
      });
      const applied = applyApprovedPayment(
        Number(invoice.total),
        Number(invoice.amountPaid),
        Number(payment.amount),
      );
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: new Prisma.Decimal(applied.amountPaid),
          ...(applied.isPaid
            ? { status: InvoiceStatus.PAID, paidAt: now }
            : {}),
        },
      });
      return payment;
    }, TX_OPTIONS);
    return {
      invoice: await this.mustFind(invoiceId),
      payment: invoicePaymentFromPrisma(paymentRow),
    };
  }

  async rejectPayment(
    invoiceId: string,
    paymentId: string,
    reviewerId: string,
    reason: string,
    now: Date,
  ): Promise<PaymentReview> {
    const paymentRow = await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, { id: invoiceId });
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        select: { status: true },
      });
      if ((invoice.status as InvoiceStatus) === InvoiceStatus.VOID) {
        throw new InvoiceRuleException("INVOICE_NOT_PAYABLE");
      }
      const updated = await tx.invoicePayment.updateMany({
        where: {
          id: paymentId,
          invoiceId,
          status: InvoicePaymentRecordStatus.PENDING_REVIEW,
        },
        data: {
          status: InvoicePaymentRecordStatus.REJECTED,
          reviewedById: reviewerId,
          reviewedAt: now,
          rejectionReason: reason,
        },
      });
      if (updated.count !== 1) {
        throw new InvoiceRuleException("PAYMENT_NOT_PENDING");
      }
      return tx.invoicePayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: INVOICE_PAYMENT_INCLUDE,
      });
    }, TX_OPTIONS);
    return {
      invoice: await this.mustFind(invoiceId),
      payment: invoicePaymentFromPrisma(paymentRow),
    };
  }

  async setFiscalPdf(
    invoiceId: string,
    data: { path: string; fiscalNumber: string | null; uploadedById: string },
  ): Promise<FiscalPdfChange> {
    const previousPath = await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, { id: invoiceId });
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        select: { status: true, fiscalPdfPath: true },
      });
      if ((invoice.status as InvoiceStatus) === InvoiceStatus.VOID) {
        throw new InvoiceRuleException("INVOICE_NOT_PAYABLE");
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          fiscalPdfPath: data.path,
          fiscalNumber: data.fiscalNumber,
          fiscalPdfUploadedAt: new Date(),
          fiscalPdfUploadedById: data.uploadedById,
        },
      });
      return invoice.fiscalPdfPath;
    }, TX_OPTIONS);
    return { invoice: await this.mustFind(invoiceId), previousPath };
  }

  async clearFiscalPdf(invoiceId: string): Promise<FiscalPdfChange> {
    const previousPath = await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, { id: invoiceId });
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        select: { fiscalPdfPath: true },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          fiscalPdfPath: null,
          fiscalNumber: null,
          fiscalPdfUploadedAt: null,
          fiscalPdfUploadedById: null,
        },
      });
      return invoice.fiscalPdfPath;
    }, TX_OPTIONS);
    return { invoice: await this.mustFind(invoiceId), previousPath };
  }

  async findDocumentData(orderId: string): Promise<InvoiceDocumentData> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        orderNumber: true,
        deliveryDate: true,
        user: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: { select: { nameEs: true } },
            productSize: { select: { nameEs: true } },
            combo: { select: { nameEs: true } },
          },
        },
      },
    });
    return {
      orderNumber: order.orderNumber,
      deliveryDate: order.deliveryDate,
      requesterName: order.user?.name ?? order.createdBy?.name ?? null,
      lines: order.items.map((item) => {
        const name = item.combo?.nameEs ?? item.product.nameEs;
        const size = item.combo ? null : (item.productSize?.nameEs ?? null);
        return {
          description: size ? `${name} · ${size}` : name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.subtotal),
        };
      }),
    };
  }

  private async mustFind(id: string): Promise<InvoiceEntity> {
    const invoice = await this.findById(id);
    if (!invoice) {
      throw new Error(`Factura ${id} no encontrada tras escribirla`);
    }
    return invoice;
  }
}
