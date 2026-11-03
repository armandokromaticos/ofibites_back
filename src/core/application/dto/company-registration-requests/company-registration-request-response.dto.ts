import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyRegistrationRequestEntity } from "../../../domain/entities/company-registration-request.entity";
import { RegistrationRequestStatus } from "../../../domain/enums/registration-request-status.enum";
import { RegistrationSolution } from "../../../domain/enums/registration-solution.enum";
import { OrderFrequency } from "../../../domain/enums/order-frequency.enum";
import { PeoplePerOrderRange } from "../../../domain/enums/people-per-order-range.enum";
import { formatRegistrationRequestFolio } from "../../../domain/services/registration-request-folio";
import { caracasYear } from "../../shared/caracas-time.util";

export class CompanyRegistrationRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description:
      "Correlativo global de la solicitud (secuencia de la BD, no se reinicia por año).",
    example: 412,
  })
  requestNumber: number;

  @ApiProperty({
    description:
      "Folio legible `SOL-AAAA-NNNN`: año de `createdAt` en hora de Caracas y `requestNumber` con al menos 4 dígitos.",
    example: "SOL-2026-0412",
  })
  folio: string;

  @ApiProperty()
  legalName: string;

  @ApiProperty()
  taxId: string;

  @ApiProperty()
  contactName: string;

  @ApiProperty()
  contactEmail: string;

  @ApiProperty()
  contactPhone: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  position: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  employeeCount: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      "Necesidad general del cliente. Null en solicitudes anteriores.",
  })
  generalNeed: string | null;

  @ApiProperty({
    enum: RegistrationSolution,
    isArray: true,
    description: "Soluciones de interés. [] en solicitudes anteriores.",
  })
  interestedSolutions: RegistrationSolution[];

  @ApiPropertyOptional({ nullable: true, enum: OrderFrequency })
  orderFrequency: OrderFrequency | null;

  @ApiPropertyOptional({ nullable: true, enum: PeoplePerOrderRange })
  peoplePerOrder: PeoplePerOrderRange | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  additionalComments: string | null;

  @ApiProperty({ enum: RegistrationRequestStatus })
  status: RegistrationRequestStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  rejectionReason: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  approvedCompanyId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(
    entity: CompanyRegistrationRequestEntity,
  ): CompanyRegistrationRequestResponseDto {
    const dto = new CompanyRegistrationRequestResponseDto();
    dto.id = entity.id;
    dto.requestNumber = entity.requestNumber;
    dto.folio = formatRegistrationRequestFolio(
      caracasYear(entity.createdAt),
      entity.requestNumber,
    );
    dto.legalName = entity.legalName;
    dto.taxId = entity.taxId;
    dto.contactName = entity.contactName;
    dto.contactEmail = entity.contactEmail;
    dto.contactPhone = entity.contactPhone;
    dto.position = entity.position;
    dto.employeeCount = entity.employeeCount;
    dto.generalNeed = entity.generalNeed;
    dto.interestedSolutions = entity.interestedSolutions;
    dto.orderFrequency = entity.orderFrequency;
    dto.peoplePerOrder = entity.peoplePerOrder;
    dto.additionalComments = entity.additionalComments;
    dto.status = entity.status;
    dto.rejectionReason = entity.rejectionReason;
    dto.reviewedAt = entity.reviewedAt;
    dto.reviewedById = entity.reviewedById;
    dto.approvedCompanyId = entity.approvedCompanyId;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class PaginatedCompanyRegistrationRequestsResponseDto {
  @ApiProperty({ type: [CompanyRegistrationRequestResponseDto] })
  data: CompanyRegistrationRequestResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
