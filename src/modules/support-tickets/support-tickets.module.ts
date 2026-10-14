import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupportTicketsController } from "./controllers/support-tickets.controller";
import { SUPPORT_TICKET_REPOSITORY } from "../../core/domain/repositories/support-ticket.repository.interface";
import { SupportTicketRepository } from "../../core/infrastructure/repositories/support-ticket.repository";
import { SupportAttachmentService } from "../../core/application/services/support-attachment.service";
import { SupportTicketAccessService } from "../../core/application/services/support-ticket-access.service";
import { CreateSupportTicketUseCase } from "../../core/application/use-cases/support-tickets/create-support-ticket.use-case";
import { GetSupportTicketsUseCase } from "../../core/application/use-cases/support-tickets/get-support-tickets.use-case";
import { GetSupportTicketUseCase } from "../../core/application/use-cases/support-tickets/get-support-ticket.use-case";
import { AddSupportMessageUseCase } from "../../core/application/use-cases/support-tickets/add-support-message.use-case";
import { UpdateTicketStatusUseCase } from "../../core/application/use-cases/support-tickets/update-ticket-status.use-case";

@Module({
  imports: [AuthModule],
  controllers: [SupportTicketsController],
  providers: [
    { provide: SUPPORT_TICKET_REPOSITORY, useClass: SupportTicketRepository },
    SupportAttachmentService,
    SupportTicketAccessService,
    CreateSupportTicketUseCase,
    GetSupportTicketsUseCase,
    GetSupportTicketUseCase,
    AddSupportMessageUseCase,
    UpdateTicketStatusUseCase,
  ],
})
export class SupportTicketsModule {}
