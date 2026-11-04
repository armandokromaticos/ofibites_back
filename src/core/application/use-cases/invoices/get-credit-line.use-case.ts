import { Injectable, NotFoundException } from "@nestjs/common";
import { CompanyBillingService } from "../../services/company-billing.service";
import { CreditLine } from "../../../domain/services/invoice-rules";

/** `GET /invoices/credit-line`: línea de crédito de la empresa (null si contado). */
@Injectable()
export class GetCreditLineUseCase {
  constructor(private readonly companyBilling: CompanyBillingService) {}

  async execute(
    companyId: string,
    now: Date = new Date(),
  ): Promise<CreditLine | null> {
    const status = await this.companyBilling.getStatus(companyId, now);
    if (!status.companyFound) {
      throw new NotFoundException("Empresa no encontrada");
    }
    return status.creditLine;
  }
}
