import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { INotificationPreferenceRepository } from "../../../domain/repositories/notification-preference.repository.interface";
import { NOTIFICATION_PREFERENCE_REPOSITORY } from "../../../domain/repositories/notification-preference.repository.interface";
import { isAlwaysPlatformEnabledPreferenceType } from "../../../domain/enums/notification-preference-type.enum";
import { UpdateNotificationPreferenceItemDto } from "../../dto/notification-preferences/update-notification-preference-item.dto";
import { NotificationPreferenceResponseDto } from "../../dto/notification-preferences/notification-preference-response.dto";
import { GetNotificationPreferencesUseCase } from "./get-notification-preferences.use-case";

/**
 * "Mi perfil" → Notificaciones: upsert parcial por (usuario, type). Solo
 * persistencia (CRUD); ningún correo se envía de verdad.
 */
@Injectable()
export class UpdateNotificationPreferencesUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly repository: INotificationPreferenceRepository,
    private readonly getNotificationPreferencesUseCase: GetNotificationPreferencesUseCase,
  ) {}

  async execute(
    userId: string,
    items: UpdateNotificationPreferenceItemDto[],
  ): Promise<NotificationPreferenceResponseDto[]> {
    // Todas las comprobaciones antes de escribir nada.
    for (const item of items) {
      if (
        item.platformEnabled === false &&
        isAlwaysPlatformEnabledPreferenceType(item.type)
      ) {
        throw new BadRequestException(
          "Los avisos de pedidos y facturas no se pueden apagar en la plataforma",
        );
      }
    }

    for (const item of items) {
      await this.repository.upsert({
        userId,
        type: item.type,
        emailEnabled: item.emailEnabled,
        platformEnabled: item.platformEnabled,
      });
    }

    return this.getNotificationPreferencesUseCase.execute(userId);
  }
}
