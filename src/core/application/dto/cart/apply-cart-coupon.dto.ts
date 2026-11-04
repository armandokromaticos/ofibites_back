import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class ApplyCartCouponDto {
  @ApiProperty({
    example: "verano2026",
    description:
      "Código promocional. Se normaliza (sin espacios a los lados y en mayúsculas) antes de buscarlo",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "El código debe ser un texto" })
  @IsNotEmpty({ message: "Escribe un código" })
  @MaxLength(64, { message: "El código no puede superar 64 caracteres" })
  code: string;
}
