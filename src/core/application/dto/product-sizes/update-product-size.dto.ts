import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateProductSizeDto {
  @ApiPropertyOptional({ example: "Grande" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  nameEs?: string;

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

  @ApiPropertyOptional({ example: 55.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

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
