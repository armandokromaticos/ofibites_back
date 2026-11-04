import { Inject, Injectable, Logger } from "@nestjs/common";
import type { INotificationRepository } from "../../domain/repositories/notification.repository.interface";
import { NOTIFICATION_REPOSITORY } from "../../domain/repositories/notification.repository.interface";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../domain/repositories/company-member.repository.interface";
import { NotificationEntity } from "../../domain/entities/notification.entity";
import { NotificationType } from "../../domain/enums/notification-type.enum";
import {
  InvoiceEntity,
  InvoicePaymentInfo,
} from "../../domain/entities/invoice.entity";
import { InvoicePaymentRecordStatus } from "../../domain/enums/invoice-payment-record-status.enum";
import { toCaracasDateKey } from "../shared/caracas-time.util";
import { formatDeliveryDate } from "./order-status-notification.service";
import { canPayInvoices } from "../shared/invoice-access";
import { formatUsd } from "../shared/invoice-errors";

const REASON_MAX = 140;

/** "Se emitió la factura #F-… del pedido #OF-… por $ 420,38. Vence el 26 de oct." */
export function buildInvoiceGeneratedMessage(
  invoice: Pick<
    InvoiceEntity,
    "invoiceNumber" | "orderNumber" | "total" | "dueDate"
  >,
  now: Date = new Date(),
): string {
  const pedido = invoice.orderNumber
    ? ` del pedido #${invoice.orderNumber}`
    : "";
  const dueKey = invoice.dueDate.toISOString().slice(0, 10);
  const vence =
    dueKey === toCaracasDateKey(now)
      ? "Vence hoy."
      : `Vence el ${formatDeliveryDate(invoice.dueDate)}.`;
  return `Se emitió la factura #${invoice.invoiceNumber}${pedido} por ${formatUsd(invoice.total)}. ${vence}`;
}

export function buildPaymentReviewedMessage(
  invoice: Pick<InvoiceEntity, "invoiceNumber">,
  payment: Pick<InvoicePaymentInfo, "status" | "rejectionReason">,
): string | null {
  if (payment.status === InvoicePaymentRecordStatus.APPROVED) {
    return `Finanzas confirmó tu pago de la factura #${invoice.invoiceNumber}.`;
  }
  if (payment.status === InvoicePaymentRecordStatus.REJECTED) {
    const reason = (payment.rejectionReason ?? "").trim();
    const short =
      reason.length > REASON_MAX
        ? `${reason.slice(0, REASON_MAX - 1)}…`
        : reason;
    return short
      ? `Finanzas rechazó tu comprobante de la factura #${invoice.invoiceNumber}: ${short}`
      : `Finanzas rechazó tu comprobante de la factura #${invoice.invoiceNumber}.`;
  }
  return null;
}

/**
 * Notificaciones in-app de facturas (T-06). Nunca lanzan: un fallo se registra
 * y la operación (ya persistida) sigue su curso.
 */
@Injectable()
export class InvoiceNotificationService {
  private readonly logger = new Logger(InvoiceNotificationService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  /** INVOICE_GENERATED a los pagadores activos de la empresa. */
  async notifyInvoiceGenerated(
    invoice: InvoiceEntity,
    orderNumber: string | null,
  ): Promise<void> {
    try {
      const members = await this.companyMemberRepository.findActiveByCompanyId(
        invoice.companyId,
      );
      const payers = new Set(
        members.filter((member) => canPayInvoices(member)).map((m) => m.userId),
      );
      const message = buildInvoiceGeneratedMessage({
        invoiceNumber: invoice.invoiceNumber,
        orderNumber: orderNumber ?? invoice.orderNumber,
        total: invoice.total,
        dueDate: invoice.dueDate,
      });
      for (const userId of payers) {
        await this.notificationRepository.create(
          NotificationEntity.forInvoice({
            type: NotificationType.INVOICE_GENERATED,
            userId,
            companyId: invoice.companyId,
            orderId: invoice.orderId,
            invoiceId: invoice.id,
            message,
          }),
        );
      }
    } catch (error) {
      this.logFailure("emisión", invoice.id, error);
    }
  }

  /** PAYMENT_STATUS_CHANGED a quien subió el comprobante. */
  async notifyPaymentReviewed(
    invoice: InvoiceEntity,
    payment: InvoicePaymentInfo,
  ): Promise<void> {
    try {
      const message = buildPaymentReviewedMessage(invoice, payment);
      if (!message) return;
      await this.notificationRepository.create(
        NotificationEntity.forInvoice({
          type: NotificationType.PAYMENT_STATUS_CHANGED,
          userId: payment.submittedById,
          companyId: invoice.companyId,
          orderId: invoice.orderId,
          invoiceId: invoice.id,
          message,
        }),
      );
    } catch (error) {
      this.logFailure("revisión del pago", invoice.id, error);
    }
  }

  private logFailure(what: string, invoiceId: string, error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(
      `No se pudo crear la notificación de ${what} de la factura ${invoiceId}: ${err.message}`,
      err.stack,
    );
  }
}
