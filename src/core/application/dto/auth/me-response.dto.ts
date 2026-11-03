import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { UserResponseDto } from "../users/user-response.dto";

export class MembershipDto {
  @ApiProperty()
  companyId: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  companyIsActive: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    format: "date-time",
    description:
      "Fecha en que la empresa completó el onboarding. null = pendiente (el COMPANY_ADMIN debe pasar por /onboarding).",
  })
  onboardingCompletedAt: string | null;

  @ApiProperty({ enum: CompanyRole })
  role: CompanyRole;

  @ApiPropertyOptional({ nullable: true, type: String })
  position: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  branchId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  branchName: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentName: string | null;

  @ApiProperty()
  canPayInvoices: boolean;

  @ApiProperty()
  isActive: boolean;
}

export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: [MembershipDto] })
  memberships: MembershipDto[];
}
