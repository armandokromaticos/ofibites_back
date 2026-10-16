import { ApiProperty } from "@nestjs/swagger";
import {
  CATALOG_ITEM_KIND,
  type CatalogItemKind,
} from "../../../domain/enums/catalog-item-kind.enum";
import { CatalogItemDto, CatalogTagDto } from "./catalog-response.dto";

export class CatalogServingOptionDto {
  @ApiProperty({ format: "uuid", description: "Id del ProductSize" })
  sizeId: string;

  @ApiProperty({ example: "8 personas", description: "Nombre del tamaño" })
  label: string;

  @ApiProperty({
    example: 8,
    nullable: true,
    type: Number,
    description: "Personas que rinde; null si no se cargó (mostrar label)",
  })
  servings: number | null;

  @ApiProperty({ example: "34.00", description: "Precio (2 decimales)" })
  price: string;

  @ApiProperty()
  isDefault: boolean;
}

export class CatalogComboItemDto {
  @ApiProperty({ format: "uuid" })
  productId: string;

  @ApiProperty({ example: "Tequeños" })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;
}

export class CatalogIngredientDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "Cebolla" })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  image: string | null;
}

/** Por porción. Gramos salvo energyKj, calories, cholesterolMg y sodiumMg. */
export class CatalogNutritionDto {
  @ApiProperty({ example: 3138, nullable: true, type: Number })
  energyKj: number | null;

  @ApiProperty({ example: 750, nullable: true, type: Number })
  calories: number | null;

  @ApiProperty({ example: 31, nullable: true, type: Number })
  fat: number | null;

  @ApiProperty({ example: 12, nullable: true, type: Number })
  saturatedFat: number | null;

  @ApiProperty({ example: 93, nullable: true, type: Number })
  carbohydrates: number | null;

  @ApiProperty({ example: 11, nullable: true, type: Number })
  sugar: number | null;

  @ApiProperty({ example: 12, nullable: true, type: Number })
  fiber: number | null;

  @ApiProperty({ example: 50, nullable: true, type: Number })
  cholesterolMg: number | null;

  @ApiProperty({ example: 610, nullable: true, type: Number })
  sodiumMg: number | null;
}

export class CatalogItemDetailDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(CATALOG_ITEM_KIND) })
  kind: CatalogItemKind;

  @ApiProperty({ example: "Surtido de pasapalos para compartir" })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({
    type: [String],
    description:
      "Imagen principal y luego la galería; en combos, la del combo y las de sus productos. Sin duplicados.",
  })
  images: string[];

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  isOnSale: boolean;

  @ApiProperty({ description: "Creado en los últimos 30 días (Caracas)" })
  isNew: boolean;

  @ApiProperty({ type: () => [CatalogTagDto] })
  tags: CatalogTagDto[];

  @ApiProperty({
    type: () => [CatalogServingOptionDto],
    description: "Tamaños activos por sortOrder; [] en combos",
  })
  servingOptions: CatalogServingOptionDto[];

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description:
      "Precio con 2 decimales: el del combo, o basePrice en un producto sin tamaños activos; null si el producto tiene tamaños (ver servingOptions)",
  })
  price: string | null;

  @ApiProperty({
    type: () => [CatalogComboItemDto],
    description: "Solo combos; [] en productos",
  })
  comboItems: CatalogComboItemDto[];

  @ApiProperty({ type: () => [CatalogIngredientDto] })
  ingredients: CatalogIngredientDto[];

  @ApiProperty({
    type: () => CatalogNutritionDto,
    nullable: true,
    description: "null si no hay ningún dato cargado y siempre en combos",
  })
  nutrition: CatalogNutritionDto | null;

  @ApiProperty({
    description: "Algún grupo de modificadores con minSelect > 0",
  })
  hasRequiredModifiers: boolean;

  @ApiProperty({
    type: () => [CatalogItemDto],
    description:
      "Hasta 8 ítems activos de las mismas secciones (o destacados si no hay), sin el propio ítem",
  })
  recommendations: CatalogItemDto[];
}
