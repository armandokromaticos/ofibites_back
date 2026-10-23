import { ApiProperty } from "@nestjs/swagger";

export class UserBreakdownRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  departmentName: string | null;

  @ApiProperty({ type: String, nullable: true })
  branchName: string | null;

  @ApiProperty()
  orders: number;

  @ApiProperty({ type: Number })
  investment: number;

  @ApiProperty({ description: "ISO 8601" })
  lastOrderAt: string;
}

export class UserBreakdownResponseDto {
  @ApiProperty({ type: () => [UserBreakdownRowDto] })
  rows: UserBreakdownRowDto[];
}
