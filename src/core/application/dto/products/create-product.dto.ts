import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateProductDto {
  @ApiProperty({ example: "Cantarito" })
  @IsString()
  @IsNotEmpty()
  nameEs: string;

  @ApiPropertyOptional({ example: "Cantarito Drink" })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: "Bebida tradicional" })
  @IsOptional()
  @IsString()
  descriptionEs?: string;

  @ApiPropertyOptional({ example: "Traditional drink" })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: "https://img.example.com/cantarito.jpg" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

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
