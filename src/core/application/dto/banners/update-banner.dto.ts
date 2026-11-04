import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsUrl,
  Min,
  MaxLength,
} from "class-validator";

/** Recorta espacios; "" (o solo espacios) pasa a null. */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export class UpdateBannerDto {
  @ApiPropertyOptional({ example: "Banner principal" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "Ideal para reuniones de 4 a 15 personas",
    maxLength: 160,
    description: 'Subtítulo bajo el título del banner. null o "" lo borran.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: "subtitle debe ser texto" })
  @MaxLength(160, { message: "subtitle admite como máximo 160 caracteres" })
  subtitle?: string | null;

  @ApiPropertyOptional({
    example: "https://cdn.cantaritos.com/banners/banner1.png",
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: "https://cdn.cantaritos.com/banners/banner1-mobile.png",
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  imageMobileUrl?: string;

  @ApiPropertyOptional({ example: "Descripcion del banner" })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: "/promociones/verano" })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: "home-carousel" })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: "#E64927" })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: "2026-03-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: "2026-03-31T23:59:59.000Z" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
