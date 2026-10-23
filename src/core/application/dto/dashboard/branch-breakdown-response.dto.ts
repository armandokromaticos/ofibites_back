import { ApiProperty } from "@nestjs/swagger";

export class BranchBreakdownRowDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "null = pedidos sin sede asignada",
  })
  branchId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  orders: number;

  @ApiProperty()
  dinersServed: number;

  @ApiProperty({ type: Number })
  investment: number;

  @ApiProperty({ type: Number })
  avgTicket: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "vs. el mes anterior; null si esa sede no facturó nada entonces",
  })
  changePercent: number | null;
}

export class BranchBreakdownTotalsDto {
  @ApiProperty()
  orders: number;

  @ApiProperty()
  dinersServed: number;

  @ApiProperty({ type: Number })
  investment: number;

  @ApiProperty({ type: Number })
  avgTicket: number;

  @ApiProperty({ type: Number, nullable: true })
  changePercent: number | null;
}

export class BranchBreakdownResponseDto {
  @ApiProperty({ type: () => [BranchBreakdownRowDto] })
  rows: BranchBreakdownRowDto[];

  @ApiProperty({ type: () => BranchBreakdownTotalsDto })
  totals: BranchBreakdownTotalsDto;
}
