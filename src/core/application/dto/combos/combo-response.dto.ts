import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ComboItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  productBasePrice: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  sortOrder: number;
}

export class ComboResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description: string | null;

  @ApiProperty()
  price: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  image: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: 'Destacado: badge "POPULAR" en el catálogo' })
  isFeatured: boolean;

  @ApiProperty({
    description: 'Marcado "En oferta" en el catálogo (aún no cambia el precio)',
  })
  isOnSale: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => [ComboItemResponseDto] })
  items?: ComboItemResponseDto[];
}
