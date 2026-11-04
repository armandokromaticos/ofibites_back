import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateBannerDto {
  @ApiPropertyOptional({ example: "Banner principal" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "Ideal para reuniones de 4 a 15 personas",
    maxLength: 160,
    description: 'Subtítulo bajo el título del banner. "" se guarda como null.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: "subtitle debe ser texto" })
  @MaxLength(160, { message: "subtitle admite como máximo 160 caracteres" })
  subtitle?: string | null;

  @ApiProperty({ example: "https://cdn.cantaritos.com/banners/banner1.png" })
  @IsString()
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({
    example: "https://cdn.cantaritos.com/banners/banner1-mobile.png",
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  imageMobileUrl?: string;

  @ApiProperty({ example: "Descripcion del banner" })
  @IsString()
  altText: string;

  @ApiPropertyOptional({ example: "/promociones/verano" })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: "home-carousel", default: "home-carousel" })
  @IsOptional()
  @IsString()
  section?: string = "home-carousel";

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number = 0;

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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
