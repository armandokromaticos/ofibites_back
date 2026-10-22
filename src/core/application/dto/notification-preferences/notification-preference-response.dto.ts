import { ApiProperty } from "@nestjs/swagger";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";

export class NotificationPreferenceResponseDto {
  @ApiProperty({ enum: NotificationPreferenceType })
  type: NotificationPreferenceType;

  @ApiProperty({
    description: "Si se avisa por correo. El back no envía el correo real.",
  })
  emailEnabled: boolean;

  @ApiProperty({
    description:
      "Si se avisa en la plataforma. Siempre true en los 5 tipos de pedidos y facturas.",
  })
  platformEnabled: boolean;
}

/** Forma de `GET`/`PATCH /auth/me/notification-preferences`: siempre los 9 tipos. */
export class NotificationPreferencesListResponseDto {
  @ApiProperty({ type: [NotificationPreferenceResponseDto] })
  preferences: NotificationPreferenceResponseDto[];
}
