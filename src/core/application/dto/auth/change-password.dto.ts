import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { IsPasswordPolicy } from "./password-policy.decorator";

export class ChangePasswordDto {
  @ApiProperty({ example: "Actual#Clave1", description: "Contraseña actual." })
  @IsString({ message: "La contraseña actual debe ser texto" })
  @IsNotEmpty({ message: "La contraseña actual es obligatoria" })
  @MaxLength(72, {
    message: "La contraseña actual admite como máximo 72 caracteres",
  })
  currentPassword: string;

  @ApiProperty({
    example: "Nueva#Clave1",
    minLength: 8,
    maxLength: 72,
    description:
      "Mínimo 8 caracteres, una mayúscula, una minúscula, un número, un símbolo y sin espacios. Distinta de la actual.",
  })
  @IsPasswordPolicy()
  newPassword: string;
}
