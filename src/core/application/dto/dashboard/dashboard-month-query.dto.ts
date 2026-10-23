import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, Matches } from "class-validator";

/** "" o solo espacios cuentan como "sin mes" (mes actual); el resto se recorta. */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export class DashboardMonthQueryDto {
  @ApiPropertyOptional({
    example: "2026-10",
    description:
      "Mes a consultar (AAAA-MM, hora de Caracas). Sin enviarlo, el mes actual.",
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "month debe tener el formato AAAA-MM con un mes entre 01 y 12",
  })
  month?: string;
}
