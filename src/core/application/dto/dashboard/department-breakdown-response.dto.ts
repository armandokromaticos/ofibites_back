import { ApiProperty } from "@nestjs/swagger";

export class DepartmentBreakdownRowDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "null = pedidos sin departamento asignado",
  })
  departmentId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Sede donde este departamento hizo más pedidos en el período (moda); null si no tiene pedidos con sede asignada",
  })
  mainBranchName: string | null;

  @ApiProperty()
  orders: number;

  @ApiProperty()
  dinersServed: number;

  @ApiProperty({ type: Number })
  investment: number;

  @ApiProperty({
    type: Number,
    description: "% de la inversión total de la empresa en el período",
  })
  percentOfTotal: number;
}

export class DepartmentBreakdownTotalsDto {
  @ApiProperty()
  orders: number;

  @ApiProperty()
  dinersServed: number;

  @ApiProperty({ type: Number })
  investment: number;

  @ApiProperty({ type: Number })
  percentOfTotal: number;
}

export class DepartmentBreakdownResponseDto {
  @ApiProperty({ type: () => [DepartmentBreakdownRowDto] })
  rows: DepartmentBreakdownRowDto[];

  @ApiProperty({ type: () => DepartmentBreakdownTotalsDto })
  totals: DepartmentBreakdownTotalsDto;
}
