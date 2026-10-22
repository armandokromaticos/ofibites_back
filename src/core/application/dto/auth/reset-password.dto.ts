import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { IsPasswordPolicy } from "./password-policy.decorator";

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
  @IsPasswordPolicy()
  password: string;
}
