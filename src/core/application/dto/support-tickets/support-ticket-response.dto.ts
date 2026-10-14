import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TicketStatus } from "../../../domain/enums/ticket-status.enum";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { SupportMessageResponseDto } from "./support-message-response.dto";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export class SupportTicketCompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  legalName: string;
}

export class SupportTicketRequesterDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class SupportTicketResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: "Número correlativo del reporte" })
  ticketNumber: number;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  createdById: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  subject: string | null;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: "Fecha en que Ofibites atendió el reporte por primera vez",
  })
  firstRespondedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    description:
      "Días transcurridos desde la creación hasta el cierre (o hasta hoy si sigue abierto)",
  })
  daysElapsed: number;

  @ApiPropertyOptional({ type: SupportTicketCompanyDto, nullable: true })
  company: SupportTicketCompanyDto | null;

  @ApiPropertyOptional({ type: SupportTicketRequesterDto, nullable: true })
  createdBy: SupportTicketRequesterDto | null;

  @ApiPropertyOptional({ type: [SupportMessageResponseDto] })
  messages?: SupportMessageResponseDto[];

  static fromEntity(entity: SupportTicketEntity): SupportTicketResponseDto {
    const dto = new SupportTicketResponseDto();
    dto.id = entity.id;
    dto.ticketNumber = entity.ticketNumber;
    dto.companyId = entity.companyId;
    dto.createdById = entity.createdById;
    dto.subject = entity.subject;
    dto.status = entity.status;
    dto.firstRespondedAt = entity.firstRespondedAt;
    dto.closedAt = entity.closedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    const until = entity.closedAt ?? new Date();
    dto.daysElapsed = Math.max(
      0,
      Math.floor((until.getTime() - entity.createdAt.getTime()) / MS_PER_DAY),
    );

    dto.company = entity.company ?? null;
    dto.createdBy = entity.createdBy ?? null;
    if (entity.messages) {
      dto.messages = entity.messages.map((message) =>
        SupportMessageResponseDto.fromEntity(message),
      );
    }
    return dto;
  }
}
