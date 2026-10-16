import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsController } from "./controllers/notifications.controller";
import { NOTIFICATION_REPOSITORY } from "../../core/domain/repositories/notification.repository.interface";
import { NotificationRepository } from "../../core/infrastructure/repositories/notification.repository";
import { OrderStatusNotificationService } from "../../core/application/services/order-status-notification.service";
import { GetNotificationsUseCase } from "../../core/application/use-cases/notifications/get-notifications.use-case";
import { MarkNotificationReadUseCase } from "../../core/application/use-cases/notifications/mark-notification-read.use-case";
import { MarkAllNotificationsReadUseCase } from "../../core/application/use-cases/notifications/mark-all-notifications-read.use-case";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
    OrderStatusNotificationService,
    GetNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
  ],
  // OrdersModule lo importa para generar notificaciones al cambiar de estado.
  exports: [OrderStatusNotificationService],
})
export class NotificationsModule {}
