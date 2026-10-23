import { ApiProperty } from "@nestjs/swagger";
import { RankedProductDto } from "./ranked-product.dto";

export class OrdersPerDayPointDto {
  @ApiProperty({
    example: "2026-05-28",
    description: "Fecha en hora de Caracas",
  })
  date: string;

  @ApiProperty({ example: 3 })
  count: number;
}

export class TopOrderDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: Date })
  createdAt: Date;
}

export class ClientDashboardResponseDto {
  @ApiProperty({ description: "Total de pedidos del scope (histórico)" })
  totalOrders: number;

  @ApiProperty({ description: "Pedidos en estados no terminales" })
  inProgressOrders: number;

  @ApiProperty({
    type: () => [OrdersPerDayPointDto],
    description:
      "Pedidos realizados por día (mes actual, por fecha de creación)",
  })
  ordersPerDay: OrdersPerDayPointDto[];

  @ApiProperty({
    type: () => [TopOrderDto],
    description: "Top 5 pedidos del mes por monto total",
  })
  topOrders: TopOrderDto[];

  @ApiProperty({
    description:
      "Comensales atendidos en el mes: suma de quantity * (servings ?? 1) de los ítems sin combo de pedidos en estados facturables (T-32a)",
  })
  dinersServed: number;

  @ApiProperty({
    type: Number,
    description:
      "Inversión del mes (suma de Order.total en estados facturables, igual criterio que la facturación del admin)",
  })
  monthInvestment: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Variación de monthInvestment vs. el mes anterior, en porcentaje. null si el mes anterior no tiene pedidos facturables con qué comparar",
  })
  monthInvestmentChangePercent: number | null;

  @ApiProperty({
    type: () => [RankedProductDto],
    description: "Top 5 productos del mes por cantidad (ítems sin combo)",
  })
  topProducts: RankedProductDto[];
}
