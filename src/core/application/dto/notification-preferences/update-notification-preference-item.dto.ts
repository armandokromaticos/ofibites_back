import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";

export class UpdateNotificationPreferenceItemDto {
  @ApiProperty({
    enum: NotificationPreferenceType,
    description: "Uno de los 9 códigos del catálogo de preferencias.",
  })
  @IsEnum(NotificationPreferenceType, {
    message:
      "type debe ser uno de los códigos válidos del catálogo de preferencias",
  })
  type: NotificationPreferenceType;

  @ApiPropertyOptional({
    description: "Si se omite, no cambia este canal.",
  })
  @IsOptional()
  @IsBoolean({ message: "emailEnabled debe ser verdadero o falso" })
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      "Si se omite, no cambia este canal. En los tipos de pedidos y facturas no se puede poner en falso.",
  })
  @IsOptional()
  @IsBoolean({ message: "platformEnabled debe ser verdadero o falso" })
  platformEnabled?: boolean;
}
