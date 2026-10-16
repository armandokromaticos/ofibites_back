import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProductSizeResponseDto } from "../product-sizes/product-size-response.dto";
import { ProductModifierGroupResponseDto } from "../product-modifier-groups/product-modifier-group-response.dto";
import { TagResponseDto } from "../tags/tag-response.dto";

export class ProductResponseDto {
  @ApiProperty()
  id: string;

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
  basePrice: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  image: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  stock: number | null;

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

  @ApiPropertyOptional({ type: () => [ProductSizeResponseDto] })
  sizes?: ProductSizeResponseDto[];

  @ApiPropertyOptional({ type: () => [ProductModifierGroupResponseDto] })
  modifierGroups?: ProductModifierGroupResponseDto[];

  @ApiPropertyOptional({ type: () => [TagResponseDto] })
  tags?: TagResponseDto[];
}
