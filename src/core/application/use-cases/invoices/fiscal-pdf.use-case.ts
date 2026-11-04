import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import { InvoiceStatus } from "../../../domain/enums/invoice-status.enum";
import { InvoiceRuleException } from "../../../domain/exceptions/invoice-rule.exception";
import {
  INVOICE_NOT_FOUND_MESSAGE,
  toInvoiceHttpError,
} from "../../shared/invoice-errors";
import {
  INVOICE_PDF_BUCKET,
  InvoiceFileStorageService,
  UploadedFileInput,
} from "../../services/invoice-file-storage.service";

/** `PUT /invoices/:id/fiscal-pdf` (Ofibites): sube o reemplaza el PDF fiscal. */
@Injectable()
export class UploadFiscalPdfUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly storage: InvoiceFileStorageService,
  ) {}

  async execute(
    uploaderId: string,
    invoiceId: string,
    file: UploadedFileInput | undefined,
    fiscalNumber: string | undefined,
  ): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
    if (invoice.status === InvoiceStatus.VOID) {
      throw toInvoiceHttpError(new InvoiceRuleException("INVOICE_NOT_PAYABLE"));
    }
    this.storage.validateFiscalPdf(file);
    const path = await this.storage.uploadFiscalPdf(
      invoice.companyId,
      invoice.id,
      file as UploadedFileInput,
    );
    try {
      const change = await this.invoiceRepository.setFiscalPdf(invoiceId, {
        path,
        fiscalNumber: fiscalNumber ?? null,
        uploadedById: uploaderId,
      });
      // El anterior se borra solo cuando la fila ya apunta al nuevo.
      await this.storage.removeQuietly(INVOICE_PDF_BUCKET, change.previousPath);
      return change.invoice;
    } catch (error) {
      await this.storage.removeQuietly(INVOICE_PDF_BUCKET, path);
      throw toInvoiceHttpError(error);
    }
  }
}

/** `DELETE /invoices/:id/fiscal-pdf` (Ofibites): vuelve a servirse la proforma. */
@Injectable()
export class RemoveFiscalPdfUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly storage: InvoiceFileStorageService,
  ) {}

  async execute(invoiceId: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
    const change = await this.invoiceRepository.clearFiscalPdf(invoiceId);
    await this.storage.removeQuietly(INVOICE_PDF_BUCKET, change.previousPath);
    return change.invoice;
  }
}
