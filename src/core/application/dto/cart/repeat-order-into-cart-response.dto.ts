import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CartResponseDto } from "./cart-response.dto";

export class CartRepeatSkippedLineDto {
  @ApiProperty()
  productId: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  comboId: string | null;

  @ApiProperty({ description: "Nombre del combo o del producto, en lang" })
  name: string;

  @ApiProperty({
    description: "Motivo en español",
    example: "Ya no está disponible",
  })
  reason: string;
}

export class RepeatOrderIntoCartResponseDto {
  @ApiProperty({ type: () => CartResponseDto })
  cart: CartResponseDto;

  @ApiProperty({ description: "Líneas del pedido copiadas (no unidades)" })
  added: number;

  @ApiProperty({ type: () => [CartRepeatSkippedLineDto] })
  skipped: CartRepeatSkippedLineDto[];
}
