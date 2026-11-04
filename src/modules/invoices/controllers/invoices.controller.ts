import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { PlatformOrCompanyRole } from "../../auth/decorators/platform-or-company-role.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CurrentCompanyMember } from "../../auth/decorators/current-company-member.decorator";
import { Role } from "../../../core/domain/enums/role.enum";
import { CompanyMemberEntity } from "../../../core/domain/entities/company-member.entity";
import {
  ALL_COMPANY_ROLES,
  PLATFORM_INVOICE_ROLES,
} from "../../../core/application/shared/invoice-access";
import { parseOptionalCompanyIdHeader } from "../../../core/application/shared/company-id-header.util";
import {
  CreateInvoicePaymentDto,
  FileDispositionQueryDto,
} from "../../../core/application/dto/invoices/invoice-request.dto";
import {
  CreditLineEnvelopeDto,
  InvoiceResponseDto,
} from "../../../core/application/dto/invoices/invoice-response.dto";
import { toCreditLineDto } from "../../../core/application/services/company-billing.service";
import { PAYMENT_PROOF_MAX_BYTES } from "../../../core/application/services/invoice-file-storage.service";
import { GetInvoiceUseCase } from "../../../core/application/use-cases/invoices/get-invoice.use-case";
import { GetInvoicePdfUseCase } from "../../../core/application/use-cases/invoices/get-invoice-pdf.use-case";
import { CreateInvoicePaymentUseCase } from "../../../core/application/use-cases/invoices/create-invoice-payment.use-case";
import { WithdrawInvoicePaymentUseCase } from "../../../core/application/use-cases/invoices/withdraw-invoice-payment.use-case";
import { GetPaymentProofUseCase } from "../../../core/application/use-cases/invoices/get-payment-proof.use-case";
import { GetCreditLineUseCase } from "../../../core/application/use-cases/invoices/get-credit-line.use-case";
import {
  invoiceIdPipe,
  paymentIdPipe,
  sendPrivateFile,
  toInvoiceActor,
} from "./invoice-http.util";

const INVOICE_CLIENT_ACCESS = {
  platformRoles: [...PLATFORM_INVOICE_ROLES],
  companyRoles: [...ALL_COMPANY_ROLES],
};

type AuthUser = { id: string; role: Role };

/**
 * Facturas del cliente (T-06). `X-Company-Id` obligatorio para clientes; una
 * factura de otra empresa responde 404. Debe registrarse antes que
 * `InvoicesAdminController` y `credit-line` va antes de `:id`.
 */
@ApiTags("Invoices")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Company-Id",
  required: false,
  description:
    "Empresa activa (obligatorio para clientes y para GET /invoices/credit-line).",
})
@Controller("invoices")
@UseGuards(JwtAuthGuard, PlatformOrCompanyRoleGuard)
export class InvoicesController {
  constructor(
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly getInvoicePdfUseCase: GetInvoicePdfUseCase,
    private readonly createInvoicePaymentUseCase: CreateInvoicePaymentUseCase,
    private readonly withdrawInvoicePaymentUseCase: WithdrawInvoicePaymentUseCase,
    private readonly getPaymentProofUseCase: GetPaymentProofUseCase,
    private readonly getCreditLineUseCase: GetCreditLineUseCase,
  ) {}

  @Get("credit-line")
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({
    summary:
      "Línea de crédito de la empresa (cupo, comprometido, disponible). creditLine null si es de contado",
  })
  @ApiOkResponse({ type: CreditLineEnvelopeDto })
  async getCreditLine(
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CreditLineEnvelopeDto> {
    const companyId = parseOptionalCompanyIdHeader(companyIdHeader);
    if (!companyId) {
      throw new BadRequestException("Header X-Company-Id requerido");
    }
    const line = await this.getCreditLineUseCase.execute(companyId);
    const dto = new CreditLineEnvelopeDto();
    dto.creditLine = line ? toCreditLineDto(line) : null;
    return dto;
  }

  @Get(":id")
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({ summary: "Factura con todos sus comprobantes" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async getInvoice(
    @Param("id", invoiceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompanyMember() member?: CompanyMemberEntity,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.getInvoiceUseCase.execute(
      toInvoiceActor(user, member),
      id,
    );
    return invoice.toResponseDto();
  }

  @Get(":id/pdf")
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({
    summary:
      "PDF de la factura: el fiscal si Ofibites lo subió; si no, la proforma generada al vuelo",
  })
  @ApiProduces("application/pdf")
  async getPdf(
    @Param("id", invoiceIdPipe) id: string,
    @Query() query: FileDispositionQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @CurrentCompanyMember() member?: CompanyMemberEntity,
  ): Promise<StreamableFile> {
    const document = await this.getInvoicePdfUseCase.execute(
      toInvoiceActor(user, member),
      id,
    );
    return sendPrivateFile(
      res,
      { ...document, mimeType: "application/pdf" },
      query.disposition,
      { "X-Invoice-Document": document.kind },
    );
  }

  @Post(":id/payments")
  @HttpCode(201)
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({
    summary:
      "Reportar un pago manual con comprobante (COMPANY_ADMIN o canPayInvoices). replacesPaymentId sustituye el que está en revisión",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["paymentDate", "method", "reference", "amount", "file"],
      properties: {
        paymentDate: { type: "string", example: "2026-09-27" },
        method: {
          type: "string",
          enum: ["MOBILE_PAYMENT", "TRANSFER_VES", "TRANSFER_USD", "ZELLE"],
        },
        bank: { type: "string" },
        reference: { type: "string" },
        amount: { type: "number", example: 420.38 },
        replacesPaymentId: { type: "string", format: "uuid" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  // Margen sobre los 5 MB: el 400 en español lo da InvoiceFileStorageService.
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: PAYMENT_PROOF_MAX_BYTES * 2 },
    }),
  )
  async createPayment(
    @Param("id", invoiceIdPipe) id: string,
    @Body() dto: CreateInvoicePaymentDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentCompanyMember() member?: CompanyMemberEntity,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.createInvoicePaymentUseCase.execute(
      toInvoiceActor(user, member),
      id,
      dto,
      file
        ? {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size,
          }
        : undefined,
    );
    return invoice.toResponseDto();
  }

  @Delete(":id/payments/:paymentId")
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({ summary: "Cancelar el envío de un comprobante en revisión" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async withdrawPayment(
    @Param("id", invoiceIdPipe) id: string,
    @Param("paymentId", paymentIdPipe) paymentId: string,
    @CurrentUser() user: AuthUser,
    @CurrentCompanyMember() member?: CompanyMemberEntity,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.withdrawInvoicePaymentUseCase.execute(
      toInvoiceActor(user, member),
      id,
      paymentId,
    );
    return invoice.toResponseDto();
  }

  @Get(":id/payments/:paymentId/proof")
  @PlatformOrCompanyRole(INVOICE_CLIENT_ACCESS)
  @ApiOperation({ summary: "Comprobante de pago (imagen o PDF)" })
  @ApiProduces("image/jpeg", "image/png", "application/pdf")
  async getProof(
    @Param("id", invoiceIdPipe) id: string,
    @Param("paymentId", paymentIdPipe) paymentId: string,
    @Query() query: FileDispositionQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @CurrentCompanyMember() member?: CompanyMemberEntity,
  ): Promise<StreamableFile> {
    const proof = await this.getPaymentProofUseCase.execute(
      toInvoiceActor(user, member),
      id,
      paymentId,
    );
    return sendPrivateFile(res, proof, query.disposition);
  }
}
