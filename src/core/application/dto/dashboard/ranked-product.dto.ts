import { ApiProperty } from "@nestjs/swagger";

/**
 * Top producto por cantidad (sin combos). Compartido entre el dashboard admin
 * (`AdminDashboardResponseDto`) y el del cliente (`ClientDashboardResponseDto`,
 * T-32a) para no duplicar la forma.
 */
export class RankedProductDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;
}
