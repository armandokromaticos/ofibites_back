import { Prisma } from "@prisma/client";
import { NotificationEntity } from "../entities/notification.entity";

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

export interface INotificationRepository {
  findFirst(
    args: Prisma.NotificationFindFirstArgs,
  ): Promise<NotificationEntity | null>;
  findMany(
    args?: Prisma.NotificationFindManyArgs,
  ): Promise<{ data: NotificationEntity[]; total?: number }>;
  count(args: Prisma.NotificationCountArgs): Promise<number>;
  create(notification: NotificationEntity): Promise<NotificationEntity>;
  /** Devuelve cuántas filas se actualizaron. */
  updateMany(args: Prisma.NotificationUpdateManyArgs): Promise<number>;
}
