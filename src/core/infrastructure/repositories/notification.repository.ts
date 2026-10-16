import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { INotificationRepository } from "../../domain/repositories/notification.repository.interface";
import { NotificationEntity } from "../../domain/entities/notification.entity";

/** Para exponer `orderNumber` real en la respuesta. */
const WITH_ORDER_NUMBER = {
  order: { select: { orderNumber: true } },
} as const satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFirst(
    args: Prisma.NotificationFindFirstArgs,
  ): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findFirst({
      ...args,
      include: WITH_ORDER_NUMBER,
    });
    return row ? NotificationEntity.fromPrisma(row) : null;
  }

  async findMany(
    args?: Prisma.NotificationFindManyArgs,
  ): Promise<{ data: NotificationEntity[]; total?: number }> {
    const rows = await this.prisma.notification.findMany({
      ...args,
      include: WITH_ORDER_NUMBER,
    });
    const data = rows.map((row) => NotificationEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.notification.count({
        where: args?.where,
      });
      return { data, total };
    }
    return { data };
  }

  count(args: Prisma.NotificationCountArgs): Promise<number> {
    return this.prisma.notification.count(args);
  }

  async create(notification: NotificationEntity): Promise<NotificationEntity> {
    const row = await this.prisma.notification.create({
      data: notification.toPrismaCreate(),
      include: WITH_ORDER_NUMBER,
    });
    return NotificationEntity.fromPrisma(row);
  }

  async updateMany(args: Prisma.NotificationUpdateManyArgs): Promise<number> {
    const result = await this.prisma.notification.updateMany(args);
    return result.count;
  }
}
