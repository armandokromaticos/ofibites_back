import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InvoicesController } from "./controllers/invoices.controller";
import { InvoicesAdminController } from "./controllers/invoices-admin.controller";
import { INVOICE_REPOSITORY } from "../../core/domain/repositories/invoice.repository.interface";
import { InvoiceRepository } from "../../core/infrastructure/repositories/invoice.repository";
import { COMPANY_REPOSITORY } from "../../core/domain/repositories/company.repository.interface";
import { CompanyRepository } from "../../core/infrastructure/repositories/company.repository";
import { CompanyBillingService } from "../../core/application/services/company-billing.service";
import { InvoiceFileStorageService } from "../../core/application/services/invoice-file-storage.service";
import { ProformaPdfService } from "../../core/application/services/proforma-pdf.service";
import { GetInvoiceUseCase } from "../../core/application/use-cases/invoices/get-invoice.use-case";
import { GetInvoicePdfUseCase } from "../../core/application/use-cases/invoices/get-invoice-pdf.use-case";
import { CreateInvoicePaymentUseCase } from "../../core/application/use-cases/invoices/create-invoice-payment.use-case";
import { WithdrawInvoicePaymentUseCase } from "../../core/application/use-cases/invoices/withdraw-invoice-payment.use-case";
import { GetPaymentProofUseCase } from "../../core/application/use-cases/invoices/get-payment-proof.use-case";
import { GetCreditLineUseCase } from "../../core/application/use-cases/invoices/get-credit-line.use-case";
import { ListInvoicesUseCase } from "../../core/application/use-cases/invoices/list-invoices.use-case";
import {
  ApproveInvoicePaymentUseCase,
  RejectInvoicePaymentUseCase,
} from "../../core/application/use-cases/invoices/review-invoice-payment.use-case";
import {
  RemoveFiscalPdfUseCase,
  UploadFiscalPdfUseCase,
} from "../../core/application/use-cases/invoices/fiscal-pdf.use-case";

@Module({
  imports: [AuthModule, NotificationsModule],
  // El controller del cliente va primero: `GET /invoices/credit-line` antes de `:id`.
  controllers: [InvoicesController, InvoicesAdminController],
  providers: [
    { provide: INVOICE_REPOSITORY, useClass: InvoiceRepository },
    { provide: COMPANY_REPOSITORY, useClass: CompanyRepository },
    CompanyBillingService,
    InvoiceFileStorageService,
    ProformaPdfService,
    GetInvoiceUseCase,
    GetInvoicePdfUseCase,
    CreateInvoicePaymentUseCase,
    WithdrawInvoicePaymentUseCase,
    GetPaymentProofUseCase,
    GetCreditLineUseCase,
    ListInvoicesUseCase,
    ApproveInvoicePaymentUseCase,
    RejectInvoicePaymentUseCase,
    UploadFiscalPdfUseCase,
    RemoveFiscalPdfUseCase,
  ],
})
export class InvoicesModule {}
