import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import {
  ORDER_FULL_INCLUDE,
  ORDER_REPOSITORY,
} from "../../../domain/repositories/order.repository.interface";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { OrderStatusNotificationService } from "../../services/order-status-notification.service";
import { InvoiceNotificationService } from "../../services/invoice-notification.service";
import { withInvoiceHttpErrors } from "../../shared/invoice-errors";

@Injectable()
export class UpdateOrderStatusUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    private readonly orderStatusNotifications: OrderStatusNotificationService,
    private readonly invoiceNotifications: InvoiceNotificationService,
  ) {}

  async execute(
    orderId: string,
    newStatus: OrderStatus,
    actorUserId?: string,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findUnique({
      where: { id: orderId },
      include: ORDER_FULL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    if (!order.canTransitionTo(newStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${newStatus}`,
      );
    }

    // Emite (CONFIRMED) o anula (CANCELLED) la factura en la misma transacción;
    // con pagos aprobados no se cancela (400 ORDER_HAS_APPROVED_PAYMENTS).
    const updated = await withInvoiceHttpErrors(() =>
      this.orderRepository.updateStatus(orderId, newStatus, order.status),
    );
    // No lanza: si falla la notificación, la transición ya quedó guardada.
    await this.orderStatusNotifications.notifyStatusChange(
      updated,
      actorUserId,
    );
    if (newStatus === OrderStatus.CONFIRMED && updated.invoice) {
      await this.invoiceNotifications.notifyInvoiceGenerated(
        updated.invoice,
        updated.orderNumber,
      );
    }
    return updated;
  }
}
