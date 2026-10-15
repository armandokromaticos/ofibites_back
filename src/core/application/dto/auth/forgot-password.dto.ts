import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Correo de la cuenta. Se normaliza con trim y minúsculas.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @MaxLength(254, { message: "email admite como máximo 254 caracteres" })
  @IsEmail({}, { message: "email debe ser un correo válido" })
  email: string;
}
