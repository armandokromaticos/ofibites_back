import { Inject, Injectable } from "@nestjs/common";
import type { INotificationPreferenceRepository } from "../../../domain/repositories/notification-preference.repository.interface";
import { NOTIFICATION_PREFERENCE_REPOSITORY } from "../../../domain/repositories/notification-preference.repository.interface";
import { NotificationPreferenceEntity } from "../../../domain/entities/notification-preference.entity";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";
import { NotificationPreferenceResponseDto } from "../../dto/notification-preferences/notification-preference-response.dto";

const ALL_PREFERENCE_TYPES = Object.values(NotificationPreferenceType);

/**
 * "Mi perfil" → Notificaciones: los 9 tipos del catálogo con sus flags.
 * Sin fila guardada para un tipo, se sintetiza el default (true, true).
 */
@Injectable()
export class GetNotificationPreferencesUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly repository: INotificationPreferenceRepository,
  ) {}

  async execute(userId: string): Promise<NotificationPreferenceResponseDto[]> {
    const saved = await this.repository.findManyByUser(userId);
    const byType = new Map(saved.map((entity) => [entity.type, entity]));

    return ALL_PREFERENCE_TYPES.map((type) =>
      (
        byType.get(type) ??
        NotificationPreferenceEntity.withDefaults(userId, type)
      ).toResponseDto(),
    );
  }
}
