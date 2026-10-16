import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateComboDto {
  @ApiProperty({ example: "Combo Familiar" })
  @IsString()
  @IsNotEmpty()
  nameEs: string;

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

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: "https://img.example.com/combo.jpg" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Destacado: badge "POPULAR" en el catálogo del cliente.',
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Marcado "En oferta" en el catálogo (todavía no cambia el precio).',
  })
  @IsOptional()
  @IsBoolean()
  isOnSale?: boolean;
}
