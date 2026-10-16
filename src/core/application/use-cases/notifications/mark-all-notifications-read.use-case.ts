import { Inject, Injectable } from "@nestjs/common";
import type { INotificationRepository } from "../../../domain/repositories/notification.repository.interface";
import { NOTIFICATION_REPOSITORY } from "../../../domain/repositories/notification.repository.interface";
import { notificationScopeWhere } from "../../shared/notification-scope.where";

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  /** Marca como leídas las no leídas del usuario (con el mismo alcance de empresa que el listado). */
  async execute(
    userId: string,
    companyId?: string,
  ): Promise<{ updated: number }> {
    const updated = await this.notificationRepository.updateMany({
      where: { ...notificationScopeWhere(userId, companyId), readAt: null },
      data: { readAt: new Date() },
    });
    return { updated };
  }
}
