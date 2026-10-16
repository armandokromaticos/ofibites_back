import { Inject, Injectable } from "@nestjs/common";
import type { INotificationRepository } from "../../../domain/repositories/notification.repository.interface";
import { NOTIFICATION_REPOSITORY } from "../../../domain/repositories/notification.repository.interface";
import { NotificationEntity } from "../../../domain/entities/notification.entity";
import {
  GetNotificationsQueryDto,
  NOTIFICATIONS_DEFAULT_TAKE,
  NOTIFICATIONS_MAX_TAKE,
} from "../../dto/notifications/get-notifications-query.dto";
import { notificationScopeWhere } from "../../shared/notification-scope.where";

export interface GetNotificationsResult {
  data: NotificationEntity[];
  total: number;
  unreadCount: number;
}

@Injectable()
export class GetNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(
    userId: string,
    query: GetNotificationsQueryDto,
    companyId?: string,
  ): Promise<GetNotificationsResult> {
    const scope = notificationScopeWhere(userId, companyId);
    const skip = query.skip ?? 0;
    const take = Math.min(
      query.take ?? NOTIFICATIONS_DEFAULT_TAKE,
      NOTIFICATIONS_MAX_TAKE,
    );

    const [page, unreadCount] = await Promise.all([
      this.notificationRepository.findMany({
        where: query.unread === true ? { ...scope, readAt: null } : scope,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.notificationRepository.count({
        where: { ...scope, readAt: null },
      }),
    ]);

    return {
      data: page.data,
      total: page.total ?? page.data.length,
      unreadCount,
    };
  }
}
