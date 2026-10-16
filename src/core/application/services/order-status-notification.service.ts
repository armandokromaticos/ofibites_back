import { Inject, Injectable, Logger } from "@nestjs/common";
import type { INotificationRepository } from "../../domain/repositories/notification.repository.interface";
import { NOTIFICATION_REPOSITORY } from "../../domain/repositories/notification.repository.interface";
import {
  NotificationEntity,
  toOrderNumber,
} from "../../domain/entities/notification.entity";
import { OrderEntity } from "../../domain/entities/order.entity";
import { OrderStatus } from "../../domain/enums/order-status.enum";

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * "HH:mm" (hora de pared de Caracas, como la guarda `Order.deliveryTime`) →
 * "10:30 am". No hay conversión de zona: el valor ya es hora local de entrega.
 * Devuelve null si el formato no es válido.
 */
export function formatDeliveryTime(deliveryTime: string | null): string | null {
  if (!deliveryTime) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(deliveryTime.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const suffix = hours < 12 ? "am" : "pm";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${match[2]} ${suffix}`;
}

/**
 * `Order.deliveryDate` es `@db.Date` (medianoche UTC de la fecha de Caracas):
 * se leen los componentes UTC para no correr el día. → "4 de sep".
 */
export function formatDeliveryDate(deliveryDate: Date | null): string | null {
  if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) return null;
  return `${deliveryDate.getUTCDate()} de ${MESES_CORTOS[deliveryDate.getUTCMonth()]}`;
}

/** Texto en español de la notificación según el estado destino; null si ese estado no se notifica. */
export function buildOrderStatusMessage(
  order: Pick<OrderEntity, "id" | "deliveryDate" | "deliveryTime">,
  status: OrderStatus,
): string | null {
  if (!order.id) return null;
  const pedido = `#${toOrderNumber(order.id)}`;
  const hora = formatDeliveryTime(order.deliveryTime);
  const fecha = formatDeliveryDate(order.deliveryDate);

  switch (status) {
    case OrderStatus.PENDING_APPROVAL:
      return `Tu pedido ${pedido} está pendiente de aprobación.`;
    case OrderStatus.PENDING_CONFIRMATION:
      return `Tu pedido ${pedido} está pendiente de confirmación por Ofibites.`;
    case OrderStatus.CONFIRMED: {
      const cuando = [
        fecha ? `el ${fecha}` : null,
        hora ? `a las ${hora}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return cuando
        ? `Tu pedido ${pedido} fue confirmado para ${cuando}.`
        : `Tu pedido ${pedido} fue confirmado.`;
    }
    case OrderStatus.REJECTED:
      return `Tu pedido ${pedido} fue rechazado.`;
    case OrderStatus.IN_ADJUSTMENT:
      return `Tu pedido ${pedido} está en ajuste. Te avisaremos cuando esté listo para confirmar.`;
    case OrderStatus.IN_PREPARATION:
      return `Tu pedido ${pedido} está en preparación.`;
    case OrderStatus.IN_TRANSIT:
      return hora
        ? `Tu pedido ${pedido} va en camino. Llega a las ${hora}.`
        : `Tu pedido ${pedido} va en camino.`;
    case OrderStatus.DELIVERED:
      return `Tu pedido ${pedido} fue entregado.`;
    case OrderStatus.CANCELLED:
      return `Tu pedido ${pedido} fue cancelado.`;
    case OrderStatus.CREATED:
    default:
      return null;
  }
}

@Injectable()
export class OrderStatusNotificationService {
  private readonly logger = new Logger(OrderStatusNotificationService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  /**
   * Crea la notificación del cambio de estado para `order.userId`, con el
   * estado que ya tiene la orden actualizada. Nunca lanza: un fallo se
   * registra y la transición (ya persistida) sigue su curso.
   *
   * No notifica si la orden no tiene usuario o si quien hizo el cambio es el
   * propio usuario (p. ej. cancela su pedido).
   */
  async notifyStatusChange(
    order: OrderEntity,
    actorUserId?: string,
  ): Promise<void> {
    try {
      if (!order.id || !order.userId) return;
      if (actorUserId && actorUserId === order.userId) return;

      const message = buildOrderStatusMessage(order, order.status);
      if (!message) return;

      await this.notificationRepository.create(
        NotificationEntity.forOrderStatus({
          userId: order.userId,
          companyId: order.companyId ?? null,
          orderId: order.id,
          orderStatus: order.status,
          message,
        }),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `No se pudo crear la notificación del pedido ${order.id ?? "?"} (${order.status}): ${err.message}`,
        err.stack,
      );
    }
  }
}
