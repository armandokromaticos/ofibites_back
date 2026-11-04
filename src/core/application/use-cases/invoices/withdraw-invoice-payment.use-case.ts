import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import { assertCanPayInvoice, InvoiceActor } from "../../shared/invoice-access";
import {
  PAYMENT_NOT_FOUND_MESSAGE,
  withInvoiceHttpErrors,
} from "../../shared/invoice-errors";

/** `DELETE /invoices/:id/payments/:paymentId` ("Cancelar envío"). */
@Injectable()
export class WithdrawInvoicePaymentUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
  ) {}

  async execute(
    actor: InvoiceActor,
    invoiceId: string,
    paymentId: string,
  ): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    assertCanPayInvoice(invoice, actor);
    if (!invoice.findPayment(paymentId)) {
      throw new NotFoundException(PAYMENT_NOT_FOUND_MESSAGE);
    }
    return withInvoiceHttpErrors(() =>
      this.invoiceRepository.withdrawPayment(invoiceId, paymentId),
    );
  }
}
