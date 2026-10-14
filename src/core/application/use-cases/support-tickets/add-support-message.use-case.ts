import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ISupportTicketRepository } from "../../../domain/repositories/support-ticket.repository.interface";
import {
  SUPPORT_TICKET_FULL_INCLUDE,
  SUPPORT_TICKET_REPOSITORY,
} from "../../../domain/repositories/support-ticket.repository.interface";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { TicketStatus } from "../../../domain/enums/ticket-status.enum";
import { Role } from "../../../domain/enums/role.enum";
import { PLATFORM_FULL_ACCESS_ROLES } from "../../shared/platform-roles.constants";
import { AddSupportMessageDto } from "../../dto/support-tickets/add-support-message.dto";
import { SupportTicketAccessService } from "../../services/support-ticket-access.service";
import {
  SupportAttachmentInput,
  SupportAttachmentService,
} from "../../services/support-attachment.service";

@Injectable()
export class AddSupportMessageUseCase {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY)
    private readonly ticketRepository: ISupportTicketRepository,
    private readonly accessService: SupportTicketAccessService,
    private readonly attachmentService: SupportAttachmentService,
  ) {}

  async execute(
    ticketId: string,
    userId: string,
    userRole: Role,
    dto: AddSupportMessageDto,
    file?: SupportAttachmentInput,
  ): Promise<SupportTicketEntity> {
    const ticket = await this.ticketRepository.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Reporte ${ticketId} no encontrado`);
    }
    await this.accessService.assertCanAccess(ticket, userId, userRole);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException(
        "El reporte está finalizado; no admite nuevos mensajes",
      );
    }

    const attachmentUrl = await this.attachmentService.upload(
      ticket.companyId,
      file,
    );

    await this.ticketRepository.addMessage({
      ticketId,
      authorId: userId,
      body: dto.body,
      attachmentUrl,
    });

    // Primera respuesta de Ofibites marca el reporte como atendido (idempotente).
    if (PLATFORM_FULL_ACCESS_ROLES.has(userRole)) {
      await this.ticketRepository.markFirstRespondedIfNull(
        ticketId,
        new Date(),
      );
    }

    const refreshed = await this.ticketRepository.findUnique({
      where: { id: ticketId },
      include: SUPPORT_TICKET_FULL_INCLUDE,
    });
    return refreshed ?? ticket;
  }
}
