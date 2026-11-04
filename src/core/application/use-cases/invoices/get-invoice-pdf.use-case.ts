import { Inject, Injectable } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import {
  assertCanReadInvoice,
  InvoiceActor,
} from "../../shared/invoice-access";
import {
  INVOICE_PDF_BUCKET,
  InvoiceFileStorageService,
} from "../../services/invoice-file-storage.service";
import { ProformaPdfService } from "../../services/proforma-pdf.service";

export interface InvoiceDocument {
  buffer: Buffer;
  fileName: string;
  kind: "FISCAL" | "PROFORMA";
}

/**
 * `GET /invoices/:id/pdf`: el PDF fiscal si Ofibites lo subió; si no, la
 * proforma generada al vuelo.
 */
@Injectable()
export class GetInvoicePdfUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly storage: InvoiceFileStorageService,
    private readonly proforma: ProformaPdfService,
  ) {}

  async execute(
    actor: InvoiceActor,
    invoiceId: string,
    now: Date = new Date(),
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    assertCanReadInvoice(invoice, actor);

    if (invoice.fiscalPdfPath) {
      const number = invoice.fiscalNumber ?? invoice.invoiceNumber;
      return {
        buffer: await this.storage.download(
          INVOICE_PDF_BUCKET,
          invoice.fiscalPdfPath,
        ),
        fileName: `factura-${number}.pdf`,
        kind: "FISCAL",
      };
    }

    const data = await this.invoiceRepository.findDocumentData(invoice.orderId);
    return {
      buffer: await this.proforma.render(invoice, data, now),
      fileName: `factura-${invoice.invoiceNumber}.pdf`,
      kind: "PROFORMA",
    };
  }
}
