import { ApiProperty } from "@nestjs/swagger";
import { NotificationType } from "../../../domain/enums/notification-type.enum";
import { OrderStatus } from "../../../domain/enums/order-status.enum";

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({
    description: "Texto en español listo para mostrar.",
    example: "Tu pedido #A1B2C3D4 va en camino. Llega a las 10:30 am.",
  })
  message: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Ruta relativa del front, p. ej. /pedidos/<id>.",
  })
  link: string | null;

  @ApiProperty({ nullable: true, type: String })
  orderId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Últimos 8 caracteres del id del pedido en mayúsculas.",
    example: "A1B2C3D4",
  })
  orderNumber: string | null;

  @ApiProperty({
    enum: OrderStatus,
    nullable: true,
    description: "Estado al que pasó el pedido (para el icono).",
  })
  orderStatus: OrderStatus | null;

  @ApiProperty({ nullable: true, type: String })
  companyId: string | null;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  readAt: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data: NotificationResponseDto[];

  @ApiProperty({
    description: "Total que cumple el filtro (no solo la página).",
  })
  total: number;

  @ApiProperty({
    description:
      "Total sin leer del usuario (con X-Company-Id, de esa empresa más las que no tienen empresa).",
  })
  unreadCount: number;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({
    description: "Cuántas notificaciones se marcaron como leídas.",
  })
  updated: number;
}
