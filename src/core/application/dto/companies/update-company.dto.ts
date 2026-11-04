import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: "Ofibites C.A." })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: "J-12345678-9" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: "contacto@ofibites.com", nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: "+58 212 555 0000", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({
    example: "Ofibites C.A.",
    description: "Razón social legal (puede diferir de legalName comercial).",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fiscalName?: string | null;

  @ApiPropertyOptional({
    example: "Av. Principal, Torre X, Piso 4, Caracas",
    description: "Dirección fiscal completa.",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fiscalAddress?: string | null;

  @ApiPropertyOptional({
    example: 30,
    description:
      "Plazo de crédito en días (0 = contado). Cliente nuevo arranca en 0–5 y sube según historial.",
    minimum: 0,
    maximum: 180,
  })
  @ValidateIf((dto: UpdateCompanyDto) => dto.creditDays !== undefined)
  @IsInt()
  @Min(0)
  @Max(180)
  creditDays?: number;

  @ApiPropertyOptional({
    example: 8000,
    nullable: true,
    description:
      "T-06: cupo de la línea de crédito en USD (solo aplica con creditDays > 0). null = sin tope.",
    minimum: 0,
  })
  @ValidateIf(
    (dto: UpdateCompanyDto) =>
      dto.creditLimit !== undefined && dto.creditLimit !== null,
  )
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    {
      message:
        "creditLimit debe ser un número mayor o igual que 0 con hasta 2 decimales",
    },
  )
  @Min(0, {
    message:
      "creditLimit debe ser un número mayor o igual que 0 con hasta 2 decimales",
  })
  @Max(99999999.99)
  creditLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
