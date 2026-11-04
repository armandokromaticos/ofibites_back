import { Inject, Injectable } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import {
  assertCanReadInvoice,
  InvoiceActor,
} from "../../shared/invoice-access";

/** `GET /invoices/:id`: factura con todos sus comprobantes. */
@Injectable()
export class GetInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
  ) {}

  async execute(
    actor: InvoiceActor,
    invoiceId: string,
  ): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    assertCanReadInvoice(invoice, actor);
    return invoice;
  }
}
