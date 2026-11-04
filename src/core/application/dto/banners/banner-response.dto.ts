import { ApiProperty } from "@nestjs/swagger";

export class BannerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: "Ideal para reuniones de 4 a 15 personas",
  })
  subtitle: string | null;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ nullable: true })
  imageMobileUrl: string | null;

  @ApiProperty()
  altText: string;

  @ApiProperty({ nullable: true })
  linkUrl: string | null;

  @ApiProperty()
  section: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ nullable: true })
  backgroundColor: string | null;

  @ApiProperty({ nullable: true })
  startDate: Date | null;

  @ApiProperty({ nullable: true })
  endDate: Date | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
