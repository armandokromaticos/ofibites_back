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

export class CreateProductSizeDto {
  @ApiProperty({ example: "Grande" })
  @IsString()
  @IsNotEmpty()
  nameEs: string;

  @ApiPropertyOptional({ example: "Large" })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: "Descripción del tamaño" })
  @IsOptional()
  @IsString()
  descriptionEs?: string;

  @ApiPropertyOptional({ example: "Size description" })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ example: 55.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 8,
    nullable: true,
    description: "Personas que rinde el tamaño (null lo borra)",
  })
  @IsOptional()
  @IsInt({ message: "servings debe ser un entero" })
  @Min(1, { message: "servings debe ser al menos 1" })
  servings?: number | null;
}
