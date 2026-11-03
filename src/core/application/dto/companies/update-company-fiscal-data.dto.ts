import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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

/**
 * T-34a: paso 1 del onboarding. Solo la dirección fiscal y el nombre fiscal
 * son editables por el cliente; la razón social (legalName) y el RIF (taxId)
 * los validó Ofibites y no se tocan aquí.
 */
export class UpdateCompanyFiscalDataDto {
  @ApiProperty({
    example: "Av. Principal, Torre X, Piso 4, Caracas",
    minLength: 1,
    maxLength: 500,
    description:
      "Dirección fiscal completa. Obligatoria; se recortan espacios.",
  })
  @Transform(trim)
  @IsString({ message: "fiscalAddress debe ser texto" })
  @MinLength(1, { message: "La dirección fiscal es obligatoria" })
  @MaxLength(500, {
    message: "La dirección fiscal admite como máximo 500 caracteres",
  })
  fiscalAddress: string;

  @ApiPropertyOptional({
    example: "Ofibites C.A.",
    nullable: true,
    type: String,
    maxLength: 200,
    description:
      'Nombre fiscal (opcional). null o "" lo borran; si no se envía, no cambia.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: "fiscalName debe ser texto" })
  @MaxLength(200, {
    message: "El nombre fiscal admite como máximo 200 caracteres",
  })
  fiscalName?: string | null;
}
