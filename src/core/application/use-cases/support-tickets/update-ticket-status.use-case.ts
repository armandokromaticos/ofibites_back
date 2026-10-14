import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ISupportTicketRepository } from "../../../domain/repositories/support-ticket.repository.interface";
import {
  SUPPORT_TICKET_FULL_INCLUDE,
  SUPPORT_TICKET_REPOSITORY,
} from "../../../domain/repositories/support-ticket.repository.interface";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { TicketStatus } from "../../../domain/enums/ticket-status.enum";

@Injectable()
export class UpdateTicketStatusUseCase {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY)
    private readonly ticketRepository: ISupportTicketRepository,
  ) {}

  async execute(
    id: string,
    status: TicketStatus,
  ): Promise<SupportTicketEntity> {
    try {
      return await this.ticketRepository.update({
        where: { id },
        data: {
          status,
          closedAt: status === TicketStatus.CLOSED ? new Date() : null,
        },
        include: SUPPORT_TICKET_FULL_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Reporte ${id} no encontrado`);
      }
      throw error;
    }
  }
}
