import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  INotificationPreferenceRepository,
  UpsertNotificationPreferenceParams,
} from "../../domain/repositories/notification-preference.repository.interface";
import { NotificationPreferenceEntity } from "../../domain/entities/notification-preference.entity";

@Injectable()
export class NotificationPreferenceRepository implements INotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUser(
    userId: string,
  ): Promise<NotificationPreferenceEntity[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    return rows.map((row) => NotificationPreferenceEntity.fromPrisma(row));
  }

  async upsert(
    params: UpsertNotificationPreferenceParams,
  ): Promise<NotificationPreferenceEntity> {
    const row = await this.prisma.notificationPreference.upsert({
      where: {
        userId_type: { userId: params.userId, type: params.type },
      },
      create: {
        userId: params.userId,
        type: params.type,
        emailEnabled: params.emailEnabled ?? true,
        platformEnabled: params.platformEnabled ?? true,
      },
      update: {
        ...(params.emailEnabled !== undefined && {
          emailEnabled: params.emailEnabled,
        }),
        ...(params.platformEnabled !== undefined && {
          platformEnabled: params.platformEnabled,
        }),
      },
    });
    return NotificationPreferenceEntity.fromPrisma(row);
  }
}
