import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export const NOTIFICATIONS_DEFAULT_TAKE = 20;
export const NOTIFICATIONS_MAX_TAKE = 50;

/** "true"/"false" (query string) → boolean; cualquier otro valor llega tal cual y lo rechaza @IsBoolean. */
function parseBooleanQuery({ value }: { value: unknown }): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "") return undefined;
  return value;
}

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      "true = solo las no leídas; false u omitido = todas (leídas y sin leer).",
  })
  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean({ message: "unread debe ser true o false" })
  unread?: boolean;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    description: "Cuántas notificaciones saltar (default 0).",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "skip debe ser un número entero" })
  @Min(0, { message: "skip no puede ser negativo" })
  skip?: number;

  @ApiPropertyOptional({
    example: NOTIFICATIONS_DEFAULT_TAKE,
    minimum: 1,
    maximum: NOTIFICATIONS_MAX_TAKE,
    description: `Cuántas devolver (default ${NOTIFICATIONS_DEFAULT_TAKE}, máximo ${NOTIFICATIONS_MAX_TAKE}).`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "take debe ser un número entero" })
  @Min(1, { message: "take debe ser al menos 1" })
  @Max(NOTIFICATIONS_MAX_TAKE, {
    message: `take no puede ser mayor que ${NOTIFICATIONS_MAX_TAKE}`,
  })
  take?: number;
}
