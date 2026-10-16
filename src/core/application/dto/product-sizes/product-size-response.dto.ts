import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProductSizeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  nameEs: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  nameEn: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  description: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  descriptionEs: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  descriptionEn: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty({ nullable: true, type: Number })
  stock: number | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Personas que rinde el tamaño",
  })
  servings: number | null;
}
