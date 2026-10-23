import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UpdateNotificationPreferenceItemDto } from "./update-notification-preference-item.dto";

/** Body de `PATCH /auth/me/notification-preferences`: lista parcial, solo lo que cambió. */
export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: () => [UpdateNotificationPreferenceItemDto] })
  @IsArray({ message: "preferences debe ser un arreglo" })
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationPreferenceItemDto)
  preferences: UpdateNotificationPreferenceItemDto[];
}
