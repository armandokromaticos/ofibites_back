import { NotificationPreference as PrismaNotificationPreference } from "@prisma/client";
import {
  NotificationPreferenceType,
  isAlwaysPlatformEnabledPreferenceType,
} from "../enums/notification-preference-type.enum";
import { NotificationPreferenceResponseDto } from "../../application/dto/notification-preferences/notification-preference-response.dto";

interface NotificationPreferenceProps {
  id: string | undefined;
  userId: string;
  type: NotificationPreferenceType;
  emailEnabled: boolean;
  platformEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreferenceEntity {
  private props: NotificationPreferenceProps;

  constructor(props: NotificationPreferenceProps) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get type(): NotificationPreferenceType {
    return this.props.type;
  }
  get emailEnabled(): boolean {
    return this.props.emailEnabled;
  }
  get platformEnabled(): boolean {
    return this.props.platformEnabled;
  }

  static fromPrisma(
    row: PrismaNotificationPreference,
  ): NotificationPreferenceEntity {
    return new NotificationPreferenceEntity({
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationPreferenceType,
      emailEnabled: row.emailEnabled,
      platformEnabled: row.platformEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Sin fila guardada: valores por defecto (true, true), sin persistir. */
  static withDefaults(
    userId: string,
    type: NotificationPreferenceType,
  ): NotificationPreferenceEntity {
    const now = new Date();
    return new NotificationPreferenceEntity({
      id: undefined,
      userId,
      type,
      emailEnabled: true,
      platformEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  toResponseDto(): NotificationPreferenceResponseDto {
    const dto = new NotificationPreferenceResponseDto();
    dto.type = this.props.type;
    dto.emailEnabled = this.props.emailEnabled;
    // Defensa: aunque la fila guardada dijera otra cosa, estos 5 tipos
    // siempre se exponen en la plataforma (el PATCH ya impide guardar false).
    dto.platformEnabled = isAlwaysPlatformEnabledPreferenceType(this.props.type)
      ? true
      : this.props.platformEnabled;
    return dto;
  }
}
