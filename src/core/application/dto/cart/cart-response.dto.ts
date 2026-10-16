import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CartItemModifierResponseDto {
  @ApiProperty()
  modifierId: string;

  @ApiProperty({ description: "Ajuste de precio vigente del modificador" })
  priceAdjustment: number;
}

export class CartItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({
    description:
      "Nombre del combo (si hay comboId) o del producto, en `lang`. Se devuelve aunque esté inactivo.",
  })
  name: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      "Imagen principal del combo o del producto (la de GET /catalog)",
  })
  image: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "Nombre del tamaño en `lang`",
  })
  sizeLabel: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: "Personas del tamaño (ProductSize.servings)",
  })
  servings: number | null;

  @ApiProperty({
    description:
      "Si la línea se podría añadir hoy (reglas de POST /cart/items). Informativo: el carrito la sigue cotizando.",
  })
  isAvailable: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  productSizeId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  comboId: string | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ description: "Precio unitario vigente (sin modificadores)" })
  unitPrice: number;

  @ApiProperty({
    description: "(unitPrice + modificadores) * quantity, con precios vigentes",
  })
  subtotal: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      "Usuario de la empresa que agregó la línea (carrito compartido)",
  })
  addedById: string | null;

  @ApiProperty({ type: () => [CartItemModifierResponseDto] })
  modifiers: CartItemModifierResponseDto[];
}

export class CartResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ type: () => [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ description: "Suma de los subtotales de las líneas" })
  subtotal: number;

  @ApiProperty({ description: "Cantidad total de unidades en el carrito" })
  totalUnits: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
