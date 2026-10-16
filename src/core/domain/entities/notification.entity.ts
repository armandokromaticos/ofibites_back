import { Notification as PrismaNotification, Prisma } from "@prisma/client";
import { NotificationType } from "../enums/notification-type.enum";
import { OrderStatus } from "../enums/order-status.enum";
import { NotificationResponseDto } from "../../application/dto/notifications/notification-response.dto";

interface NotificationProps {
  id: string | undefined;
  /** `Order.orderNumber` si la fila se cargó con el pedido. */
  orderNumber?: string | null;
  userId: string;
  companyId: string | null;
  type: NotificationType;
  message: string;
  link: string | null;
  orderId: string | null;
  orderStatus: OrderStatus | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateOrderStatusNotificationParams {
  userId: string;
  companyId: string | null;
  orderId: string;
  orderStatus: OrderStatus;
  message: string;
}

/**
 * Respaldo del número del pedido: los últimos 8 caracteres del id en
 * mayúsculas. Solo para pedidos sin `Order.orderNumber` (anteriores al
 * backfill de T-26a).
 */
export function toOrderNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

/** Ruta relativa del front al detalle del pedido. */
export function toOrderLink(orderId: string): string {
  return `/pedidos/${orderId}`;
}

export class NotificationEntity {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get companyId(): string | null {
    return this.props.companyId;
  }
  get type(): NotificationType {
    return this.props.type;
  }
  get message(): string {
    return this.props.message;
  }
  get link(): string | null {
    return this.props.link;
  }
  get orderId(): string | null {
    return this.props.orderId;
  }
  get orderStatus(): OrderStatus | null {
    return this.props.orderStatus;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get isRead(): boolean {
    return this.props.readAt !== null;
  }

  static fromPrisma(
    row: PrismaNotification & { order?: { orderNumber: string | null } | null },
  ): NotificationEntity {
    return new NotificationEntity({
      id: row.id,
      orderNumber: row.order?.orderNumber ?? null,
      userId: row.userId,
      companyId: row.companyId,
      type: row.type as NotificationType,
      message: row.message,
      link: row.link,
      orderId: row.orderId,
      orderStatus: (row.orderStatus as OrderStatus | null) ?? null,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }

  static forOrderStatus(
    params: CreateOrderStatusNotificationParams,
  ): NotificationEntity {
    const message = params.message.trim();
    if (message.length === 0) {
      throw new Error("El mensaje de la notificación no puede estar vacío");
    }
    return new NotificationEntity({
      id: undefined,
      userId: params.userId,
      companyId: params.companyId,
      type: NotificationType.ORDER_STATUS,
      message,
      link: toOrderLink(params.orderId),
      orderId: params.orderId,
      orderStatus: params.orderStatus,
      readAt: null,
      createdAt: new Date(),
    });
  }

  toPrismaCreate(): Prisma.NotificationUncheckedCreateInput {
    return {
      userId: this.props.userId,
      companyId: this.props.companyId,
      type: this.props.type,
      message: this.props.message,
      link: this.props.link,
      orderId: this.props.orderId,
      orderStatus: this.props.orderStatus,
    };
  }

  toResponseDto(): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = this.props.id ?? "";
    dto.type = this.props.type;
    dto.message = this.props.message;
    dto.link = this.props.link;
    dto.orderId = this.props.orderId;
    dto.orderNumber = this.props.orderId
      ? (this.props.orderNumber ?? toOrderNumber(this.props.orderId))
      : null;
    dto.orderStatus = this.props.orderStatus;
    dto.companyId = this.props.companyId;
    dto.readAt = this.props.readAt ? this.props.readAt.toISOString() : null;
    dto.createdAt = this.props.createdAt.toISOString();
    return dto;
  }
}
