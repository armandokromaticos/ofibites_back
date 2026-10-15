import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    description:
      "access_token de la sesión de recuperación que Supabase deja en el hash de /reset-password.",
  })
  @IsString({ message: "accessToken debe ser texto" })
  @IsNotEmpty({ message: "accessToken es obligatorio" })
  @MaxLength(4096, { message: "accessToken es demasiado largo" })
  accessToken: string;

  @ApiProperty({
    example: "Nueva#Clave1",
    minLength: 8,
    maxLength: 72,
    description:
      "Mínimo 8 caracteres, una mayúscula, una minúscula, un número, un símbolo y sin espacios.",
  })
  @IsString({ message: "La contraseña debe ser texto" })
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  @MaxLength(72, {
    message: "La contraseña admite como máximo 72 caracteres",
  })
  @Matches(/[A-Z]/, {
    message: "La contraseña debe incluir al menos una letra mayúscula",
  })
  @Matches(/[a-z]/, {
    message: "La contraseña debe incluir al menos una letra minúscula",
  })
  @Matches(/\d/, { message: "La contraseña debe incluir al menos un número" })
  @Matches(/[^A-Za-z0-9\s]/, {
    message: "La contraseña debe incluir al menos un símbolo",
  })
  @Matches(/^\S+$/, { message: "La contraseña no puede contener espacios" })
  password: string;
}
