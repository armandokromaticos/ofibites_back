import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ISupportTicketRepository } from "../../../domain/repositories/support-ticket.repository.interface";
import {
  SUPPORT_TICKET_FULL_INCLUDE,
  SUPPORT_TICKET_REPOSITORY,
} from "../../../domain/repositories/support-ticket.repository.interface";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { Role } from "../../../domain/enums/role.enum";
import { SupportTicketAccessService } from "../../services/support-ticket-access.service";

@Injectable()
export class GetSupportTicketUseCase {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY)
    private readonly ticketRepository: ISupportTicketRepository,
    private readonly accessService: SupportTicketAccessService,
  ) {}

  async execute(
    id: string,
    userId: string,
    userRole: Role,
  ): Promise<SupportTicketEntity> {
    const ticket = await this.ticketRepository.findUnique({
      where: { id },
      include: SUPPORT_TICKET_FULL_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Reporte ${id} no encontrado`);
    }
    await this.accessService.assertCanAccess(ticket, userId, userRole);
    return ticket;
  }
}
