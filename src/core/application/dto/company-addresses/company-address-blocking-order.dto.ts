import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * T-31a: pedido en curso (`ORDER_IN_PROGRESS_STATUSES`) que usa esta
 * dirección como `deliveryAddressId`, para que el front avise antes de
 * intentar borrarla (Figma 3659:2271). El `DELETE` real sigue siendo el
 * gate (409 por FK activo); este endpoint es solo informativo.
 */
export class CompanyAddressBlockingOrderDto {
  @ApiProperty({
    example: "OF-2026-0007",
    description:
      "Order.orderNumber; respaldo de los últimos 8 del id si el pedido no lo tiene",
  })
  orderNumber: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: "2026-10-09T00:00:00.000Z",
    description:
      "ISO 8601, medianoche UTC de la fecha de entrega; null solo en pedidos antiguos sin fecha",
  })
  deliveryDate: string | null;
}
