import { ApiProperty } from "@nestjs/swagger";
import type { CatalogItemKind } from "../../../domain/enums/catalog-item-kind.enum";

export type { CatalogItemKind };

export class CatalogCategoryDto {
  @ApiProperty({ example: "coffee-break" })
  slug: string;

  @ApiProperty({ example: "Coffee Break" })
  name: string;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: 5, description: "Ítems activos de la sección" })
  count: number;
}

export class CatalogTagDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "Saludable" })
  name: string;
}

export class CatalogItemDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: ["product", "combo"] })
  kind: CatalogItemKind;

  @ApiProperty({ example: "Surtido: Coffee Break AM" })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String })
  image: string | null;

  @ApiProperty({ example: "45.00", description: "Precio mínimo (2 decimales)" })
  priceFrom: string;

  @ApiProperty({
    example: "120.00",
    description: "Precio máximo (2 decimales)",
  })
  priceTo: string;

  @ApiProperty({ type: () => [CatalogTagDto] })
  tags: CatalogTagDto[];

  @ApiProperty({ description: "Creado en los últimos 30 días (Caracas)" })
  isNew: boolean;

  @ApiProperty({ description: 'Badge "POPULAR"' })
  isFeatured: boolean;

  @ApiProperty({ description: '"En oferta" (aún no cambia el precio)' })
  isOnSale: boolean;
}

export class CatalogItemsPageDto {
  @ApiProperty({ type: () => [CatalogItemDto] })
  data: CatalogItemDto[];

  @ApiProperty({ example: 26 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 12 })
  pageSize: number;
}

export class CatalogResponseDto {
  @ApiProperty({ type: () => [CatalogCategoryDto] })
  categories: CatalogCategoryDto[];

  @ApiProperty({ example: 26, description: 'Ítems activos ("Todos")' })
  totalItems: number;

  @ApiProperty({ type: () => [CatalogTagDto] })
  preferences: CatalogTagDto[];

  @ApiProperty({ type: () => CatalogItemsPageDto })
  items: CatalogItemsPageDto;
}
