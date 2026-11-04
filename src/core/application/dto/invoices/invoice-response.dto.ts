import { ApiProperty } from "@nestjs/swagger";
import { InvoiceStatus } from "../../../domain/enums/invoice-status.enum";
import { InvoicePaymentStatus } from "../../../domain/enums/invoice-payment-status.enum";
import { InvoicePaymentRecordStatus } from "../../../domain/enums/invoice-payment-record-status.enum";
import { PaymentMethod } from "../../../domain/enums/payment-method.enum";

export class InvoicePaymentProofDto {
  @ApiProperty({ example: "comprobante-pago-001244.jpg" })
  fileName: string;

  @ApiProperty({ example: "image/jpeg" })
  mimeType: string;

  @ApiProperty({ example: 1003520 })
  sizeBytes: number;
}

export class InvoicePaymentUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: "Luis Alberto Márquez" })
  name: string;
}

export class InvoicePaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: InvoicePaymentRecordStatus,
    enumName: "InvoicePaymentRecordStatus",
  })
  status: InvoicePaymentRecordStatus;

  @ApiProperty({ enum: PaymentMethod, enumName: "PaymentMethod" })
  method: PaymentMethod;

  @ApiProperty({ nullable: true, type: String })
  bank: string | null;

  @ApiProperty({ example: "0102-88431" })
  reference: string;

  @ApiProperty({ description: "Monto declarado, en USD", example: 420.38 })
  amount: number;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Fecha del pago (fecha pura: medianoche UTC)",
  })
  paymentDate: string;

  @ApiProperty({ type: String, format: "date-time" })
  submittedAt: string;

  @ApiProperty({ type: () => InvoicePaymentUserDto })
  submittedBy: InvoicePaymentUserDto;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  reviewedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  rejectionReason: string | null;

  @ApiProperty({ type: () => InvoicePaymentProofDto })
  proof: InvoicePaymentProofDto;
}

/** `invoice` de `OrderResponseDto` (resumen con el último comprobante). */
export class OrderInvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: "F-2026-0007" })
  invoiceNumber: string;

  @ApiProperty({ enum: InvoiceStatus, enumName: "InvoiceStatus" })
  status: InvoiceStatus;

  @ApiProperty({
    enum: InvoicePaymentStatus,
    enumName: "InvoicePaymentStatus",
    description:
      "Derivado: PAID · VOID · IN_REVIEW · OVERDUE · REJECTED · PENDING (en ese orden de precedencia)",
  })
  paymentStatus: InvoicePaymentStatus;

  @ApiProperty({ type: String, format: "date-time" })
  issuedAt: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Fecha pura (medianoche UTC); mostrar sin convertir zona",
  })
  dueDate: string;

  @ApiProperty()
  creditDays: number;

  @ApiProperty({ description: "creditDays > 0" })
  isCredit: boolean;

  @ApiProperty()
  isOverdue: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "dueDate − hoy (Caracas); negativo si vencida; null si PAID o VOID",
  })
  daysUntilDue: number | null;

  @ApiProperty()
  total: number;

  @ApiProperty()
  amountPaid: number;

  @ApiProperty()
  balance: number;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  paidAt: string | null;

  @ApiProperty()
  hasFiscalPdf: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Número de la factura fiscal, si Ofibites lo dio",
  })
  fiscalNumber: string | null;

  @ApiProperty({ nullable: true, type: () => InvoicePaymentResponseDto })
  latestPayment: InvoicePaymentResponseDto | null;
}

export class InvoiceBillingDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  taxId: string;

  @ApiProperty({ nullable: true, type: String })
  address: string | null;
}

export class InvoiceResponseDto extends OrderInvoiceResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty({ nullable: true, type: String })
  orderNumber: string | null;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ nullable: true, type: String })
  companyName: string | null;

  @ApiProperty({ type: () => InvoiceBillingDto })
  billing: InvoiceBillingDto;

  @ApiProperty({
    type: () => [InvoicePaymentResponseDto],
    description: "Todos los registros de pago, del más reciente al más antiguo",
  })
  payments: InvoicePaymentResponseDto[];
}

export class PaginatedInvoiceResponseDto {
  @ApiProperty({ type: () => [InvoiceResponseDto] })
  data: InvoiceResponseDto[];

  @ApiProperty()
  total: number;
}

export class CreditLineResponseDto {
  @ApiProperty()
  creditDays: number;

  @ApiProperty({ nullable: true, type: Number, description: "null = sin tope" })
  creditLimit: number | null;

  @ApiProperty({ description: "Saldo de las facturas sin pagar" })
  committed: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "max(0, cupo − comprometido); null sin tope",
  })
  available: number | null;

  @ApiProperty({ description: "La empresa tiene alguna factura vencida" })
  isBlocked: boolean;
}

export class CreditLineEnvelopeDto {
  @ApiProperty({
    nullable: true,
    type: () => CreditLineResponseDto,
    description: "null si la empresa es de contado",
  })
  creditLine: CreditLineResponseDto | null;
}
