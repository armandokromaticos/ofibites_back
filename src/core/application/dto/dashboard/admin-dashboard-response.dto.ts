import { ApiProperty } from "@nestjs/swagger";
import { OrdersPerDayPointDto } from "./client-dashboard-response.dto";
import { RankedProductDto } from "./ranked-product.dto";

export { RankedProductDto };

export class RankedComboDto {
  @ApiProperty()
  comboId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;
}

export class RankedCompanyDto {
  @ApiProperty()
  companyId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: Number, description: "Monto facturado del mes" })
  total: number;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ description: "Pedidos con fecha de entrega hoy (Caracas)" })
  ordersToday: number;

  @ApiProperty({ description: "Pedidos en preparación" })
  inPreparation: number;

  @ApiProperty({ description: "Pedidos en tránsito" })
  inTransit: number;

  @ApiProperty({
    type: Number,
    description:
      "Facturación del mes (suma de pedidos confirmados en adelante)",
  })
  billingThisMonth: number;

  @ApiProperty({
    type: () => [OrdersPerDayPointDto],
    description:
      "Pedidos recibidos por día (mes actual, por fecha de creación)",
  })
  ordersPerDay: OrdersPerDayPointDto[];

  @ApiProperty({
    type: () => [RankedProductDto],
    description: "Top 5 productos por cantidad (ítems sin combo)",
  })
  topProducts: RankedProductDto[];

  @ApiProperty({
    type: () => [RankedComboDto],
    description: "Surtido más vendido: top 5 combos por cantidad",
  })
  topCombos: RankedComboDto[];

  @ApiProperty({
    type: () => [RankedCompanyDto],
    description: "Top 5 empresas por facturación del mes",
  })
  top5Companies: RankedCompanyDto[];
}
