import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvoicePaymentStatus } from "../../../domain/enums/invoice-payment-status.enum";
import { CreditLineResponseDto } from "../invoices/invoice-response.dto";

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

  @ApiProperty({
    type: [String],
    example: ["Opción vegetariana", "Sin gluten"],
    description:
      "Nombres de los tags activos del producto en `lang` (en cae a es), ordenados por nombre. `[]` si no tiene o si la línea es un combo.",
  })
  tags: string[];

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

export class CartSummaryResponseDto {
  @ApiProperty({ example: 120.5, description: "Suma de las líneas" })
  subtotal: number;

  @ApiProperty({
    example: 12.05,
    description:
      "Descuento del cupón aplicado (calculateDiscount sobre subtotal, con tope maxDiscount); 0 sin cupón o si `coupon.isValid` es false",
  })
  discount: number;

  @ApiProperty({ example: 0.16, description: "Tasa de IVA" })
  taxRate: number;

  @ApiProperty({
    example: 19.28,
    description: "(subtotal − discount) × taxRate, redondeado al céntimo",
  })
  tax: number;

  @ApiProperty({
    example: 5,
    description:
      "0 si (subtotal − discount) ≥ freeShippingThreshold o el carrito está vacío; si no, SHIPPING_FLAT_FEE",
  })
  shipping: number;

  @ApiProperty({ example: 150 })
  freeShippingThreshold: number;

  @ApiProperty({
    example: 144.78,
    description: "subtotal − discount + tax + shipping",
  })
  total: number;
}

export class CartCouponResponseDto {
  @ApiProperty({ example: "VERANO2026", description: "Código (Coupon.nameEs)" })
  code: string;

  @ApiProperty({ example: 10, description: "Porcentaje de descuento" })
  discountPercent: number;

  @ApiProperty({
    description:
      "Si el cupón sigue aplicando a este usuario y empresa al leer el carrito. Si es false, summary.discount = 0 y el checkout lo rechaza: el front debe avisar y ofrecer quitarlo",
  })
  isValid: boolean;
}

export class CartInvoiceAlertInvoiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ example: "F-2026-0042" })
  invoiceNumber: string;

  @ApiProperty({ nullable: true, type: String, example: "OF-2026-0107" })
  orderNumber: string | null;

  @ApiProperty({ example: 340 })
  balance: number;

  @ApiProperty({ type: String, format: "date-time", description: "Fecha pura" })
  dueDate: string;

  @ApiProperty({ description: "Negativo si está vencida" })
  daysUntilDue: number;

  @ApiProperty({ enum: InvoicePaymentStatus, enumName: "InvoicePaymentStatus" })
  paymentStatus: InvoicePaymentStatus;
}

export class CartInvoiceAlertDto {
  @ApiProperty({ enum: ["OVERDUE", "DUE_SOON"] })
  level: "OVERDUE" | "DUE_SOON";

  @ApiProperty({ description: "true solo con OVERDUE" })
  blocksCheckout: boolean;

  @ApiProperty({ description: "Facturas en ese nivel" })
  count: number;

  @ApiProperty({
    type: () => CartInvoiceAlertInvoiceDto,
    description: "La vencida más antigua o la que vence antes",
  })
  invoice: CartInvoiceAlertInvoiceDto;
}

export class CartCreditLineDto extends CreditLineResponseDto {
  @ApiProperty({
    description:
      "summary.total > available (false sin tope); el checkout daría CREDIT_LIMIT_EXCEEDED",
  })
  exceedsAvailable: boolean;
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

  @ApiProperty({
    type: () => CartSummaryResponseDto,
    description:
      "Importes calculados en el servidor (IVA, envío, total). Son los que usa POST /orders/checkout",
  })
  summary: CartSummaryResponseDto;

  @ApiPropertyOptional({
    type: () => CartCouponResponseDto,
    nullable: true,
    description: "Cupón aplicado (POST /cart/coupon); null si no hay",
  })
  coupon: CartCouponResponseDto | null;

  @ApiProperty({
    type: () => CartInvoiceAlertDto,
    nullable: true,
    description:
      "T-06: factura vencida (bloquea el checkout) o que vence en 0–3 días; null si no hay",
  })
  invoiceAlert: CartInvoiceAlertDto | null;

  @ApiProperty({
    type: () => CartCreditLineDto,
    nullable: true,
    description: "T-06: línea de crédito de la empresa; null si es de contado",
  })
  creditLine: CartCreditLineDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
