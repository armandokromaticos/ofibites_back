import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import { InvoiceRuleException } from "../../../domain/exceptions/invoice-rule.exception";
import { toCents, utcMidnightOf } from "../../../domain/services/invoice-rules";
import { CreateInvoicePaymentDto } from "../../dto/invoices/invoice-request.dto";
import { assertCanPayInvoice, InvoiceActor } from "../../shared/invoice-access";
import { toInvoiceHttpError } from "../../shared/invoice-errors";
import { toCaracasDateKey } from "../../shared/caracas-time.util";
import {
  InvoiceFileStorageService,
  PAYMENT_PROOF_BUCKET,
  UploadedFileInput,
} from "../../services/invoice-file-storage.service";

/**
 * `POST /invoices/:id/payments`: el cliente reporta un pago manual con su
 * comprobante. Con `replacesPaymentId`, el que estaba en revisión pasa a
 * `WITHDRAWN` en la misma transacción en la que se crea el nuevo.
 */
@Injectable()
export class CreateInvoicePaymentUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly storage: InvoiceFileStorageService,
  ) {}

  async execute(
    actor: InvoiceActor,
    invoiceId: string,
    dto: CreateInvoicePaymentDto,
    file: UploadedFileInput | undefined,
    now: Date = new Date(),
  ): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    assertCanPayInvoice(invoice, actor);

    if (dto.paymentDate > toCaracasDateKey(now)) {
      throw new BadRequestException("La fecha del pago no puede ser futura");
    }
    // Comprobaciones previas para no subir un archivo en balde; la
    // transacción las repite con la fila bloqueada.
    if (!invoice.isPayable) {
      throw toInvoiceHttpError(new InvoiceRuleException("INVOICE_NOT_PAYABLE"));
    }
    if (toCents(dto.amount) > toCents(invoice.balance)) {
      throw toInvoiceHttpError(
        new InvoiceRuleException("PAYMENT_AMOUNT_EXCEEDS_BALANCE", {
          balance: invoice.balance,
        }),
      );
    }
    const pending = invoice.pendingPayment;
    if (dto.replacesPaymentId) {
      if (!pending || pending.id !== dto.replacesPaymentId) {
        throw toInvoiceHttpError(
          new InvoiceRuleException("PAYMENT_NOT_PENDING"),
        );
      }
    } else if (pending) {
      throw toInvoiceHttpError(
        new InvoiceRuleException("PAYMENT_ALREADY_PENDING"),
      );
    }

    const kind = this.storage.validateProof(file);
    const stored = await this.storage.uploadProof(
      invoice.companyId,
      invoice.id,
      file as UploadedFileInput,
      kind,
    );
    try {
      return await this.invoiceRepository.createPayment({
        invoiceId: invoice.id,
        method: dto.method,
        bank: dto.bank ?? null,
        reference: dto.reference,
        amount: dto.amount,
        paymentDate: utcMidnightOf(dto.paymentDate),
        proofPath: stored.path,
        proofFileName: stored.fileName,
        proofMimeType: stored.mimeType,
        proofSizeBytes: stored.sizeBytes,
        submittedById: actor.userId,
        replacesPaymentId: dto.replacesPaymentId,
      });
    } catch (error) {
      await this.storage.removeQuietly(PAYMENT_PROOF_BUCKET, stored.path);
      throw toInvoiceHttpError(error);
    }
  }
}
