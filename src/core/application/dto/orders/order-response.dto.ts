import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderPriority } from "../../../domain/enums/order-priority.enum";
import { OrderStatusGroup } from "../../../domain/services/order-status-groups";

export class OrderItemModifierResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  modifierId: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Oculto para roles sin acceso a precios",
  })
  priceAdjustment: number | null;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  productSizeId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  comboId: string | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Oculto para roles sin acceso a precios",
  })
  unitPrice: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Oculto para roles sin acceso a precios",
  })
  subtotal: number | null;

  @ApiPropertyOptional({ type: () => [OrderItemModifierResponseDto] })
  modifiers?: OrderItemModifierResponseDto[];
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  userId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  couponId: string | null;

  @ApiProperty()
  companyId: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  branchId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentId: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  deliveryAddressId: string;

  @ApiPropertyOptional({ nullable: true, type: Date })
  deliveryDate: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  deliveryTime: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  notes: string | null;

  @ApiProperty({ enum: OrderPriority })
  priority: OrderPriority;

  @ApiProperty()
  status: string;

  @ApiProperty({
    enum: OrderStatusGroup,
    description:
      'Grupo visible para "Pedidos realizados" del cliente. Calculado a partir de `status`, no es una columna de BD.',
  })
  statusGroup: OrderStatusGroup;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Oculto para roles sin acceso a precios",
  })
  subtotal: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Oculto para roles sin acceso a precios",
  })
  discount: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "IVA congelado al crear el pedido (0 en pedidos anteriores al checkout). Oculto para roles sin acceso a precios",
  })
  tax: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Envío congelado al crear el pedido (0 en pedidos anteriores al checkout). Oculto para roles sin acceso a precios",
  })
  shipping: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "subtotal − discount + tax + shipping. Oculto para roles sin acceso a precios",
  })
  total: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "OF-2026-0042",
    description: "Número legible, secuencial por año de Caracas",
  })
  orderNumber: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  receiverName: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  receiverPhone: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "Piso / oficina",
  })
  addressDetail: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "Punto de referencia",
  })
  addressReference: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => [OrderItemResponseDto] })
  items?: OrderItemResponseDto[];
}

/**
 * Forma de `GET /orders` cuando se pide paginación (`skip` y/o `take`). Sin
 * ellos, el endpoint sigue devolviendo el array plano de `OrderResponseDto[]`
 * (no rompe a los consumidores actuales, p. ej. el dashboard).
 */
export class PaginatedOrderResponseDto {
  @ApiProperty({ type: () => [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty({ description: "Total de órdenes que cumple el filtro." })
  total: number;
}
