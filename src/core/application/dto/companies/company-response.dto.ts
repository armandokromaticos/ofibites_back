import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyEntity } from "../../../domain/entities/company.entity";

export class CompanyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  legalName: string;

  @ApiProperty()
  taxId: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  phone: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "Razón social legal (puede diferir de legalName comercial).",
  })
  fiscalName: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "Dirección fiscal completa.",
  })
  fiscalAddress: string | null;

  @ApiProperty({
    example: 30,
    description:
      "Plazo de crédito en días (0 = contado, hasta 180). Histórico del cliente, no atado a cada pedido.",
  })
  creditDays: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    format: "date-time",
    description:
      "Fecha en que el COMPANY_ADMIN completó el onboarding. null = pendiente.",
  })
  onboardingCompletedAt: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: CompanyEntity): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = entity.id;
    dto.legalName = entity.legalName;
    dto.taxId = entity.taxId;
    dto.email = entity.email;
    dto.phone = entity.phone;
    dto.fiscalName = entity.fiscalName;
    dto.fiscalAddress = entity.fiscalAddress;
    dto.creditDays = entity.creditDays;
    dto.isActive = entity.isActive;
    dto.onboardingCompletedAt =
      entity.onboardingCompletedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
