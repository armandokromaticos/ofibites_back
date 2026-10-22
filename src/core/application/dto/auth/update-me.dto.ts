import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

/** Recorta espacios; en campos borrables, "" (o solo espacios) pasa a null. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: "María Pérez",
    minLength: 1,
    maxLength: 120,
    description: "Nombre completo. No admite null ni vacío.",
  })
  // Solo se omite si no viene: null llega a la validación y da 400.
  @ValidateIf((dto: UpdateMeDto) => dto.name !== undefined)
  @Transform(trim)
  @IsString({ message: "name debe ser texto" })
  @MinLength(1, { message: "name no puede estar vacío" })
  @MaxLength(120, { message: "name admite como máximo 120 caracteres" })
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "+58 412-555-1234",
    maxLength: 30,
    description: 'null o "" borran el teléfono.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: "phone debe ser texto" })
  @MaxLength(30, { message: "phone admite como máximo 30 caracteres" })
  phone?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "Gerente de compras",
    maxLength: 100,
    description:
      'Cargo en la empresa de X-Company-Id (obligatorio si se envía este campo). null o "" lo borran.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: "position debe ser texto" })
  @MaxLength(100, { message: "position admite como máximo 100 caracteres" })
  position?: string | null;
}
