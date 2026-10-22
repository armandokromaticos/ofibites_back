import { NotificationPreferenceEntity } from "../entities/notification-preference.entity";
import { NotificationPreferenceType } from "../enums/notification-preference-type.enum";

export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol(
  "NOTIFICATION_PREFERENCE_REPOSITORY",
);

export interface UpsertNotificationPreferenceParams {
  userId: string;
  type: NotificationPreferenceType;
  /** `undefined` = no cambiar este campo (upsert parcial). */
  emailEnabled?: boolean;
  platformEnabled?: boolean;
}

export interface INotificationPreferenceRepository {
  findManyByUser(userId: string): Promise<NotificationPreferenceEntity[]>;
  upsert(
    params: UpsertNotificationPreferenceParams,
  ): Promise<NotificationPreferenceEntity>;
}
