import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CompanyAddressType } from "../../../domain/enums/company-address-type.enum";

export class UpdateCompanyAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  line1?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  state?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  country?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip?: string | null;

  @ApiPropertyOptional({ description: '"Quién recibe" en esta dirección' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  contactName?: string;

  @ApiPropertyOptional({
    description:
      "Teléfono de contacto de la sede, texto libre (sin validación de formato)",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBilling?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isShipping?: boolean;

  @ApiPropertyOptional({
    description:
      "Marcar como sede principal. Un solo primario por empresa: true desmarca cualquier otra dirección primaria de la misma empresa.",
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    enum: CompanyAddressType,
    nullable: true,
    description: "Tipo de sede (onboarding). Opcional; null lo borra.",
  })
  @IsOptional()
  @IsEnum(CompanyAddressType, {
    message: "type debe ser OFFICE, WAREHOUSE u OTHER",
  })
  type?: CompanyAddressType | null;
}
