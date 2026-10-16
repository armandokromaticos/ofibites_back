import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { INotificationRepository } from "../../../domain/repositories/notification.repository.interface";
import { NOTIFICATION_REPOSITORY } from "../../../domain/repositories/notification.repository.interface";
import { NotificationEntity } from "../../../domain/entities/notification.entity";

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  /**
   * Marca como leída una notificación del usuario. Idempotente: si ya estaba
   * leída conserva su `readAt`. 404 si no existe o es de otro usuario (no se
   * revela que exista).
   */
  async execute(
    notificationId: string,
    userId: string,
  ): Promise<NotificationEntity> {
    const where = { id: notificationId, userId };
    const notification = await this.notificationRepository.findFirst({
      where,
    });
    if (!notification) {
      throw new NotFoundException("Notificación no encontrada");
    }
    if (notification.isRead) {
      return notification;
    }

    // `readAt: null` en el filtro: si otra petición la marcó entre medias, no
    // se pisa su fecha.
    await this.notificationRepository.updateMany({
      where: { ...where, readAt: null },
      data: { readAt: new Date() },
    });

    const updated = await this.notificationRepository.findFirst({ where });
    if (!updated) {
      throw new NotFoundException("Notificación no encontrada");
    }
    return updated;
  }
}
