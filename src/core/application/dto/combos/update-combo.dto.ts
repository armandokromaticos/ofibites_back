import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateComboDto {
  @ApiPropertyOptional({ example: "Combo Familiar" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  nameEs?: string;

  @ApiPropertyOptional({ example: "Family Combo" })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: "Incluye 4 cantaritos y 2 micheladas" })
  @IsOptional()
  @IsString()
  descriptionEs?: string;

  @ApiPropertyOptional({ example: "Includes 4 cantaritos and 2 micheladas" })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ example: 150.0 })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: "https://img.example.com/combo.jpg" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Destacado: badge "POPULAR" en el catálogo del cliente.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Marcado "En oferta" en el catálogo (todavía no cambia el precio).',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isOnSale?: boolean;
}
