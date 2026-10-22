import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";

export class CompanyMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: "Nombre del User asociado" })
  name: string;

  @ApiProperty({ description: "Correo del User asociado (no editable aquí)" })
  email: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ enum: CompanyRole })
  role: CompanyRole;

  @ApiPropertyOptional({ nullable: true, type: String })
  position: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  branchId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentId: string | null;

  @ApiProperty()
  canPayInvoices: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ nullable: true, type: Date })
  lastSeenAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: CompanyMemberEntity): CompanyMemberResponseDto {
    const dto = new CompanyMemberResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.name = entity.userName ?? "";
    dto.email = entity.userEmail ?? "";
    dto.phone = entity.userPhone ?? null;
    dto.companyId = entity.companyId;
    dto.role = entity.role;
    dto.position = entity.position;
    dto.branchId = entity.branchId;
    dto.departmentId = entity.departmentId;
    dto.canPayInvoices = entity.canPayInvoices;
    dto.isActive = entity.isActive;
    dto.lastSeenAt = entity.lastSeenAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
