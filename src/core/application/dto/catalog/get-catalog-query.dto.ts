import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Lang } from "../../../domain/enums/lang.enum";
import { CatalogFilter } from "../../../domain/enums/catalog-filter.enum";

export const CATALOG_DEFAULT_PAGE_SIZE = 12;
export const CATALOG_MAX_PAGE_SIZE = 48;

/** "" o solo espacios cuentan como "sin filtro"; el resto se recorta. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** "a,b , c" → ["a", "b", "c"]; vacío → undefined. */
function commaSeparatedToArray({ value }: { value: unknown }): unknown {
  const raw: unknown[] = Array.isArray(value) ? value : [value];
  if (raw.some((part) => typeof part !== "string")) return value;
  const parts = (raw as string[])
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return parts.length > 0 ? Array.from(new Set(parts)) : undefined;
}

export class GetCatalogQueryDto {
  @ApiPropertyOptional({ enum: Lang, default: Lang.ES })
  @IsOptional()
  @IsEnum(Lang, { message: "lang solo admite: es, en" })
  lang?: Lang;

  @ApiPropertyOptional({
    example: "coffee-break",
    description: 'Slug de una sección activa. Sin él, se lista "Todos".',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: "section debe ser un texto" })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "section debe ser un slug válido (p. ej. coffee-break)",
  })
  section?: string;

  @ApiPropertyOptional({
    type: String,
    example: "8c1d…,f2a9…",
    description:
      "Ids de tags separados por coma; el ítem debe tenerlos todos (AND).",
  })
  @IsOptional()
  @Transform(commaSeparatedToArray)
  @IsArray({ message: "tags debe ser una lista de ids separados por coma" })
  @ArrayMaxSize(20, { message: "tags admite como máximo 20 ids" })
  @IsUUID("all", { each: true, message: "cada tag debe ser un UUID válido" })
  tags?: string[];

  @ApiPropertyOptional({ enum: CatalogFilter, default: CatalogFilter.ALL })
  @IsOptional()
  @IsEnum(CatalogFilter, { message: "filter solo admite: all, new, on-sale" })
  filter?: CatalogFilter;

  @ApiPropertyOptional({
    example: "cafe",
    minLength: 2,
    maxLength: 100,
    description:
      "Busca en nombre y descripción, sin distinguir mayúsculas ni acentos.",
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: "search debe ser un texto" })
  @MinLength(2, { message: "search debe tener al menos 2 caracteres" })
  @MaxLength(100, { message: "search admite como máximo 100 caracteres" })
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page debe ser un entero" })
  @Min(1, { message: "page debe ser al menos 1" })
  page?: number;

  @ApiPropertyOptional({
    example: CATALOG_DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: CATALOG_MAX_PAGE_SIZE,
    default: CATALOG_DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "pageSize debe ser un entero" })
  @Min(1, { message: "pageSize debe ser al menos 1" })
  @Max(CATALOG_MAX_PAGE_SIZE, {
    message: `pageSize admite como máximo ${CATALOG_MAX_PAGE_SIZE}`,
  })
  pageSize?: number;
}
