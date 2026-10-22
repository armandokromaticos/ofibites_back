import { applyDecorators } from "@nestjs/common";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Política de contraseña de Ofibites (restablecer y cambiar contraseña):
 * 8 a 72 caracteres, una mayúscula, una minúscula, un número, un símbolo y
 * sin espacios.
 */
export function IsPasswordPolicy(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: "La contraseña debe ser texto" }),
    MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    MaxLength(72, {
      message: "La contraseña admite como máximo 72 caracteres",
    }),
    Matches(/[A-Z]/, {
      message: "La contraseña debe incluir al menos una letra mayúscula",
    }),
    Matches(/[a-z]/, {
      message: "La contraseña debe incluir al menos una letra minúscula",
    }),
    Matches(/\d/, { message: "La contraseña debe incluir al menos un número" }),
    Matches(/[^A-Za-z0-9\s]/, {
      message: "La contraseña debe incluir al menos un símbolo",
    }),
    Matches(/^\S+$/, { message: "La contraseña no puede contener espacios" }),
  );
}
