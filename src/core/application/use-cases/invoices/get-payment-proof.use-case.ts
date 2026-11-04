import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import {
  assertCanReadInvoice,
  InvoiceActor,
} from "../../shared/invoice-access";
import { PAYMENT_NOT_FOUND_MESSAGE } from "../../shared/invoice-errors";
import {
  InvoiceFileStorageService,
  PAYMENT_PROOF_BUCKET,
} from "../../services/invoice-file-storage.service";

export interface PaymentProofFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

/** `GET /invoices/:id/payments/:paymentId/proof`: el comprobante subido. */
@Injectable()
export class GetPaymentProofUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly storage: InvoiceFileStorageService,
  ) {}

  async execute(
    actor: InvoiceActor,
    invoiceId: string,
    paymentId: string,
  ): Promise<PaymentProofFile> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    assertCanReadInvoice(invoice, actor);
    const payment = invoice.findPayment(paymentId);
    if (!payment) throw new NotFoundException(PAYMENT_NOT_FOUND_MESSAGE);
    return {
      buffer: await this.storage.download(
        PAYMENT_PROOF_BUCKET,
        payment.proofPath,
      ),
      fileName: payment.proofFileName,
      mimeType: payment.proofMimeType,
    };
  }
}
