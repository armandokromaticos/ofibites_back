import { Inject, Injectable } from "@nestjs/common";
import type { IInvoiceRepository } from "../../domain/repositories/invoice.repository.interface";
import { INVOICE_REPOSITORY } from "../../domain/repositories/invoice.repository.interface";
import type { ICompanyRepository } from "../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../domain/repositories/company.repository.interface";
import {
  computeCreditLine,
  computeInvoiceAlert,
  CreditLine,
  InvoiceAlert,
  OpenInvoiceSnapshot,
  overdueInvoices,
} from "../../domain/services/invoice-rules";
import { CreditLineResponseDto } from "../dto/invoices/invoice-response.dto";

export interface CompanyBillingStatus {
  /** false si la empresa no existe (todo lo demás vacío). */
  companyFound: boolean;
  open: OpenInvoiceSnapshot[];
  overdue: OpenInvoiceSnapshot[];
  alert: InvoiceAlert | null;
  creditLine: CreditLine | null;
}

/**
 * Estado de facturación de una empresa (T-06): facturas abiertas, vencidas,
 * aviso del carrito y línea de crédito. Una consulta de facturas `PENDING` y
 * una de la empresa; lo usan el carrito, el checkout y `GET /invoices/credit-line`.
 */
@Injectable()
export class CompanyBillingService {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async getStatus(
    companyId: string,
    now: Date = new Date(),
  ): Promise<CompanyBillingStatus> {
    const [invoices, company] = await Promise.all([
      this.invoiceRepository.findOpenByCompany(companyId),
      this.companyRepository.findUnique({ where: { id: companyId } }),
    ]);
    const open = invoices.map((invoice) => invoice.toOpenSnapshot());
    return {
      companyFound: company !== null,
      open,
      overdue: overdueInvoices(open, now),
      alert: computeInvoiceAlert(open, now),
      creditLine: company
        ? computeCreditLine(
            {
              creditDays: company.creditDays,
              creditLimit: company.creditLimit,
            },
            open,
            now,
          )
        : null,
    };
  }
}

export function toCreditLineDto(line: CreditLine): CreditLineResponseDto {
  const dto = new CreditLineResponseDto();
  dto.creditDays = line.creditDays;
  dto.creditLimit = line.creditLimit;
  dto.committed = line.committed;
  dto.available = line.available;
  dto.isBlocked = line.isBlocked;
  return dto;
}
