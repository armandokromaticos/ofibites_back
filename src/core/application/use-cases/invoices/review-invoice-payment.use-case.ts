import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import {
  INVOICE_NOT_FOUND_MESSAGE,
  PAYMENT_NOT_FOUND_MESSAGE,
  withInvoiceHttpErrors,
} from "../../shared/invoice-errors";
import { InvoiceNotificationService } from "../../services/invoice-notification.service";

async function assertPaymentExists(
  repository: IInvoiceRepository,
  invoiceId: string,
  paymentId: string,
): Promise<void> {
  const invoice = await repository.findById(invoiceId);
  if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
  if (!invoice.findPayment(paymentId)) {
    throw new NotFoundException(PAYMENT_NOT_FOUND_MESSAGE);
  }
}

/**
 * `POST /invoices/:id/payments/:paymentId/approve` (Ofibites): suma el pago a
 * `amountPaid` y, si cubre el total, la factura pasa a PAID.
 */
@Injectable()
export class ApproveInvoicePaymentUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly notifications: InvoiceNotificationService,
  ) {}

  async execute(
    reviewerId: string,
    invoiceId: string,
    paymentId: string,
    now: Date = new Date(),
  ): Promise<InvoiceEntity> {
    await assertPaymentExists(this.invoiceRepository, invoiceId, paymentId);
    const { invoice, payment } = await withInvoiceHttpErrors(() =>
      this.invoiceRepository.approvePayment(
        invoiceId,
        paymentId,
        reviewerId,
        now,
      ),
    );
    await this.notifications.notifyPaymentReviewed(invoice, payment);
    return invoice;
  }
}

/** `POST /invoices/:id/payments/:paymentId/reject` (Ofibites), con motivo. */
@Injectable()
export class RejectInvoicePaymentUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly notifications: InvoiceNotificationService,
  ) {}

  async execute(
    reviewerId: string,
    invoiceId: string,
    paymentId: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<InvoiceEntity> {
    await assertPaymentExists(this.invoiceRepository, invoiceId, paymentId);
    const { invoice, payment } = await withInvoiceHttpErrors(() =>
      this.invoiceRepository.rejectPayment(
        invoiceId,
        paymentId,
        reviewerId,
        reason,
        now,
      ),
    );
    await this.notifications.notifyPaymentReviewed(invoice, payment);
    return invoice;
  }
}
