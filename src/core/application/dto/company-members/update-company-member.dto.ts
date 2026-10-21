import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { CompanyRole } from "../../../domain/enums/company-role.enum";

export class UpdateCompanyMemberDto {
  @ApiPropertyOptional({ example: "Juan Perez" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ nullable: true, example: "+584141234567" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ enum: CompanyRole })
  @IsOptional()
  @IsEnum(CompanyRole)
  role?: CompanyRole;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canPayInvoices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
