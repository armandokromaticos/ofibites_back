import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Role } from "../../../core/domain/enums/role.enum";
import {
  ListInvoicesQueryDto,
  RejectInvoicePaymentDto,
  UploadFiscalPdfDto,
} from "../../../core/application/dto/invoices/invoice-request.dto";
import {
  InvoiceResponseDto,
  PaginatedInvoiceResponseDto,
} from "../../../core/application/dto/invoices/invoice-response.dto";
import { FISCAL_PDF_MAX_BYTES } from "../../../core/application/services/invoice-file-storage.service";
import { ListInvoicesUseCase } from "../../../core/application/use-cases/invoices/list-invoices.use-case";
import {
  ApproveInvoicePaymentUseCase,
  RejectInvoicePaymentUseCase,
} from "../../../core/application/use-cases/invoices/review-invoice-payment.use-case";
import {
  RemoveFiscalPdfUseCase,
  UploadFiscalPdfUseCase,
} from "../../../core/application/use-cases/invoices/fiscal-pdf.use-case";
import { invoiceIdPipe, paymentIdPipe } from "./invoice-http.util";

/** Endpoints de Ofibites (sin pantalla, desde Swagger). T-06. */
@ApiTags("Invoices (Ofibites)")
@ApiBearerAuth()
@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.FINANCE_ADMIN)
export class InvoicesAdminController {
  constructor(
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly approveInvoicePaymentUseCase: ApproveInvoicePaymentUseCase,
    private readonly rejectInvoicePaymentUseCase: RejectInvoicePaymentUseCase,
    private readonly uploadFiscalPdfUseCase: UploadFiscalPdfUseCase,
    private readonly removeFiscalPdfUseCase: RemoveFiscalPdfUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Cola de facturas (filtros: paymentStatus, companyId, overdue). IN_REVIEW, del comprobante más antiguo al más reciente",
  })
  @ApiOkResponse({ type: PaginatedInvoiceResponseDto })
  async list(
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    const { data, total } = await this.listInvoicesUseCase.execute(query);
    const response = new PaginatedInvoiceResponseDto();
    response.data = data.map((invoice) => invoice.toResponseDto());
    response.total = total;
    return response;
  }

  @Post(":id/payments/:paymentId/approve")
  @ApiOperation({ summary: "Aprobar un comprobante en revisión" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async approve(
    @Param("id", invoiceIdPipe) id: string,
    @Param("paymentId", paymentIdPipe) paymentId: string,
    @CurrentUser() user: { id: string },
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.approveInvoicePaymentUseCase.execute(
      user.id,
      id,
      paymentId,
    );
    return invoice.toResponseDto();
  }

  @Post(":id/payments/:paymentId/reject")
  @ApiOperation({ summary: "Rechazar un comprobante en revisión, con motivo" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async reject(
    @Param("id", invoiceIdPipe) id: string,
    @Param("paymentId", paymentIdPipe) paymentId: string,
    @Body() dto: RejectInvoicePaymentDto,
    @CurrentUser() user: { id: string },
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.rejectInvoicePaymentUseCase.execute(
      user.id,
      id,
      paymentId,
      dto.reason,
    );
    return invoice.toResponseDto();
  }

  @Put(":id/fiscal-pdf")
  @ApiOperation({
    summary: "Subir o reemplazar el PDF fiscal (sustituye a la proforma)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        fiscalNumber: { type: "string" },
      },
    },
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: FISCAL_PDF_MAX_BYTES * 2 } }),
  )
  async uploadFiscalPdf(
    @Param("id", invoiceIdPipe) id: string,
    @Body() dto: UploadFiscalPdfDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string },
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.uploadFiscalPdfUseCase.execute(
      user.id,
      id,
      file
        ? {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size,
          }
        : undefined,
      dto.fiscalNumber,
    );
    return invoice.toResponseDto();
  }

  @Delete(":id/fiscal-pdf")
  @ApiOperation({ summary: "Quitar el PDF fiscal (vuelve la proforma)" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async removeFiscalPdf(
    @Param("id", invoiceIdPipe) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.removeFiscalPdfUseCase.execute(id);
    return invoice.toResponseDto();
  }
}
