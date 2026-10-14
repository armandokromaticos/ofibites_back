import { Inject, Injectable } from "@nestjs/common";
import type { ISupportTicketRepository } from "../../../domain/repositories/support-ticket.repository.interface";
import {
  SUPPORT_TICKET_LIST_INCLUDE,
  SUPPORT_TICKET_REPOSITORY,
} from "../../../domain/repositories/support-ticket.repository.interface";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { Role } from "../../../domain/enums/role.enum";
import {
  SupportTicketAccessService,
  SupportTicketListFilters,
} from "../../services/support-ticket-access.service";

@Injectable()
export class GetSupportTicketsUseCase {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY)
    private readonly ticketRepository: ISupportTicketRepository,
    private readonly accessService: SupportTicketAccessService,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    filters: SupportTicketListFilters,
  ): Promise<SupportTicketEntity[]> {
    const where = await this.accessService.resolveListWhere(
      userId,
      userRole,
      filters,
    );
    const { data } = await this.ticketRepository.findMany({
      where,
      include: SUPPORT_TICKET_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return data;
  }
}
