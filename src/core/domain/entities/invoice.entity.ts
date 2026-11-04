import {
  Invoice as PrismaInvoice,
  InvoicePayment as PrismaInvoicePayment,
} from "@prisma/client";
import { InvoiceStatus } from "../enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../enums/invoice-payment-record-status.enum";
import { InvoicePaymentStatus } from "../enums/invoice-payment-status.enum";
import { PaymentMethod } from "../enums/payment-method.enum";
import {
  daysUntilDue,
  derivePaymentStatus,
  invoiceBalance,
  isInvoiceOverdue,
  OpenInvoiceSnapshot,
} from "../services/invoice-rules";
import {
  InvoicePaymentResponseDto,
  InvoiceResponseDto,
  OrderInvoiceResponseDto,
} from "../../application/dto/invoices/invoice-response.dto";

export type PrismaInvoicePaymentRow = PrismaInvoicePayment & {
  submittedBy?: { id: string; name: string } | null;
};

export type PrismaInvoiceRow = PrismaInvoice & {
  payments?: PrismaInvoicePaymentRow[];
  order?: { orderNumber: string | null } | null;
  company?: { legalName: string } | null;
};

export interface InvoicePaymentInfo {
  id: string;
  invoiceId: string;
  status: InvoicePaymentRecordStatus;
  method: PaymentMethod;
  bank: string | null;
  reference: string;
  amount: number;
  paymentDate: Date;
  proofPath: string;
  proofFileName: string;
  proofMimeType: string;
  proofSizeBytes: number;
  submittedById: string;
  submittedByName: string | null;
  submittedAt: Date;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  withdrawnAt: Date | null;
}

interface InvoiceProps {
  id: string;
  invoiceNumber: string;
  orderId: string;
  companyId: string;
  status: InvoiceStatus;
  issuedAt: Date;
  dueDate: Date;
  creditDays: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  amountPaid: number;
  paidAt: Date | null;
  voidedAt: Date | null;
  billingName: string;
  billingTaxId: string;
  billingAddress: string | null;
  fiscalPdfPath: string | null;
  fiscalNumber: string | null;
  fiscalPdfUploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Del más reciente al más antiguo. Puede venir solo el último (resumen). */
  payments: InvoicePaymentInfo[];
  orderNumber: string | null;
  companyName: string | null;
}

export function invoicePaymentFromPrisma(
  row: PrismaInvoicePaymentRow,
): InvoicePaymentInfo {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    status: row.status as InvoicePaymentRecordStatus,
    method: row.method as PaymentMethod,
    bank: row.bank,
    reference: row.reference,
    amount: Number(row.amount),
    paymentDate: row.paymentDate,
    proofPath: row.proofPath,
    proofFileName: row.proofFileName,
    proofMimeType: row.proofMimeType,
    proofSizeBytes: row.proofSizeBytes,
    submittedById: row.submittedById,
    submittedByName: row.submittedBy?.name ?? null,
    submittedAt: row.submittedAt,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    withdrawnAt: row.withdrawnAt,
  };
}

function paymentToDto(payment: InvoicePaymentInfo): InvoicePaymentResponseDto {
  const dto = new InvoicePaymentResponseDto();
  dto.id = payment.id;
  dto.status = payment.status;
  dto.method = payment.method;
  dto.bank = payment.bank;
  dto.reference = payment.reference;
  dto.amount = payment.amount;
  dto.paymentDate = payment.paymentDate.toISOString();
  dto.submittedAt = payment.submittedAt.toISOString();
  dto.submittedBy = {
    id: payment.submittedById,
    name: payment.submittedByName ?? "",
  };
  dto.reviewedAt = payment.reviewedAt?.toISOString() ?? null;
  dto.rejectionReason = payment.rejectionReason;
  dto.proof = {
    fileName: payment.proofFileName,
    mimeType: payment.proofMimeType,
    sizeBytes: payment.proofSizeBytes,
  };
  return dto;
}

export class InvoiceEntity {
  private constructor(private readonly props: InvoiceProps) {}

  static fromPrisma(row: PrismaInvoiceRow): InvoiceEntity {
    return new InvoiceEntity({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      orderId: row.orderId,
      companyId: row.companyId,
      status: row.status as InvoiceStatus,
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
      creditDays: row.creditDays,
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      shipping: Number(row.shipping),
      total: Number(row.total),
      amountPaid: Number(row.amountPaid),
      paidAt: row.paidAt,
      voidedAt: row.voidedAt,
      billingName: row.billingName,
      billingTaxId: row.billingTaxId,
      billingAddress: row.billingAddress,
      fiscalPdfPath: row.fiscalPdfPath,
      fiscalNumber: row.fiscalNumber,
      fiscalPdfUploadedAt: row.fiscalPdfUploadedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payments: (row.payments ?? []).map(invoicePaymentFromPrisma),
      orderNumber: row.order?.orderNumber ?? null,
      companyName: row.company?.legalName ?? null,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get invoiceNumber(): string {
    return this.props.invoiceNumber;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get companyId(): string {
    return this.props.companyId;
  }
  get status(): InvoiceStatus {
    return this.props.status;
  }
  get issuedAt(): Date {
    return this.props.issuedAt;
  }
  get dueDate(): Date {
    return this.props.dueDate;
  }
  get creditDays(): number {
    return this.props.creditDays;
  }
  get subtotal(): number {
    return this.props.subtotal;
  }
  get discount(): number {
    return this.props.discount;
  }
  get tax(): number {
    return this.props.tax;
  }
  get shipping(): number {
    return this.props.shipping;
  }
  get total(): number {
    return this.props.total;
  }
  get amountPaid(): number {
    return this.props.amountPaid;
  }
  get balance(): number {
    return invoiceBalance(this.props.total, this.props.amountPaid);
  }
  get paidAt(): Date | null {
    return this.props.paidAt;
  }
  get billingName(): string {
    return this.props.billingName;
  }
  get billingTaxId(): string {
    return this.props.billingTaxId;
  }
  get billingAddress(): string | null {
    return this.props.billingAddress;
  }
  get fiscalPdfPath(): string | null {
    return this.props.fiscalPdfPath;
  }
  get fiscalNumber(): string | null {
    return this.props.fiscalNumber;
  }
  get orderNumber(): string | null {
    return this.props.orderNumber;
  }
  get companyName(): string | null {
    return this.props.companyName;
  }
  get payments(): InvoicePaymentInfo[] {
    return this.props.payments;
  }
  get latestPayment(): InvoicePaymentInfo | null {
    return this.props.payments[0] ?? null;
  }
  get pendingPayment(): InvoicePaymentInfo | null {
    return (
      this.props.payments.find(
        (payment) =>
          payment.status === InvoicePaymentRecordStatus.PENDING_REVIEW,
      ) ?? null
    );
  }
  /** Pagos aprobados, del más antiguo al más reciente. */
  get approvedPayments(): InvoicePaymentInfo[] {
    return this.props.payments
      .filter(
        (payment) => payment.status === InvoicePaymentRecordStatus.APPROVED,
      )
      .reverse();
  }
  get isPayable(): boolean {
    return this.props.status === InvoiceStatus.PENDING;
  }

  findPayment(paymentId: string): InvoicePaymentInfo | null {
    return (
      this.props.payments.find((payment) => payment.id === paymentId) ?? null
    );
  }

  paymentStatus(now: Date = new Date()): InvoicePaymentStatus {
    return derivePaymentStatus(
      {
        status: this.props.status,
        dueDate: this.props.dueDate,
        latestPaymentStatus: this.latestPayment?.status ?? null,
        hasPendingReview: this.pendingPayment !== null,
      },
      now,
    );
  }

  isOverdue(now: Date = new Date()): boolean {
    return isInvoiceOverdue(this.props, now);
  }

  toOpenSnapshot(): OpenInvoiceSnapshot {
    return {
      id: this.props.id,
      orderId: this.props.orderId,
      invoiceNumber: this.props.invoiceNumber,
      orderNumber: this.props.orderNumber,
      total: this.props.total,
      amountPaid: this.props.amountPaid,
      dueDate: this.props.dueDate,
      hasPendingReview: this.pendingPayment !== null,
      latestPaymentStatus: this.latestPayment?.status ?? null,
    };
  }

  private fillSummary(dto: OrderInvoiceResponseDto, now: Date): void {
    const open = this.props.status === InvoiceStatus.PENDING;
    dto.id = this.props.id;
    dto.invoiceNumber = this.props.invoiceNumber;
    dto.status = this.props.status;
    dto.paymentStatus = this.paymentStatus(now);
    dto.issuedAt = this.props.issuedAt.toISOString();
    dto.dueDate = this.props.dueDate.toISOString();
    dto.creditDays = this.props.creditDays;
    dto.isCredit = this.props.creditDays > 0;
    dto.isOverdue = this.isOverdue(now);
    dto.daysUntilDue = open ? daysUntilDue(this.props.dueDate, now) : null;
    dto.total = this.props.total;
    dto.amountPaid = this.props.amountPaid;
    dto.balance = this.balance;
    dto.paidAt = this.props.paidAt?.toISOString() ?? null;
    dto.hasFiscalPdf = this.props.fiscalPdfPath !== null;
    dto.fiscalNumber = this.props.fiscalNumber;
    const latest = this.latestPayment;
    dto.latestPayment = latest ? paymentToDto(latest) : null;
  }

  /** Resumen para `OrderResponseDto.invoice`. */
  toSummaryDto(now: Date = new Date()): OrderInvoiceResponseDto {
    const dto = new OrderInvoiceResponseDto();
    this.fillSummary(dto, now);
    return dto;
  }

  /** `InvoiceResponseDto` completo (requiere los pagos cargados). */
  toResponseDto(now: Date = new Date()): InvoiceResponseDto {
    const dto = new InvoiceResponseDto();
    this.fillSummary(dto, now);
    dto.orderId = this.props.orderId;
    dto.orderNumber = this.props.orderNumber;
    dto.companyId = this.props.companyId;
    dto.companyName = this.props.companyName;
    dto.billing = {
      name: this.props.billingName,
      taxId: this.props.billingTaxId,
      address: this.props.billingAddress,
    };
    dto.payments = this.props.payments.map(paymentToDto);
    return dto;
  }
}
