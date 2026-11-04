import { Inject, Injectable } from "@nestjs/common";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import { ListInvoicesQueryDto } from "../../dto/invoices/invoice-request.dto";

/** `GET /invoices` (Ofibites): cola de facturas con filtros. */
@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
  ) {}

  execute(
    query: ListInvoicesQueryDto,
    now: Date = new Date(),
  ): Promise<{ data: InvoiceEntity[]; total: number }> {
    return this.invoiceRepository.findMany({
      paymentStatus: query.paymentStatus,
      companyId: query.companyId,
      overdue: query.overdue,
      skip: query.skip ?? 0,
      take: query.take ?? 20,
      now,
    });
  }
}
