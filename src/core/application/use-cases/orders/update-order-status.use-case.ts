import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { OrderStatusNotificationService } from "../../services/order-status-notification.service";

@Injectable()
export class UpdateOrderStatusUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    private readonly orderStatusNotifications: OrderStatusNotificationService,
  ) {}

  async execute(
    orderId: string,
    newStatus: OrderStatus,
    actorUserId?: string,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    if (!order.canTransitionTo(newStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${newStatus}`,
      );
    }

    const updated = await this.orderRepository.updateStatus(orderId, newStatus);
    // No lanza: si falla la notificación, la transición ya quedó guardada.
    await this.orderStatusNotifications.notifyStatusChange(
      updated,
      actorUserId,
    );
    return updated;
  }
}
