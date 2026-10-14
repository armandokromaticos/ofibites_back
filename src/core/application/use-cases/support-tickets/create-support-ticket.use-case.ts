import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { ISupportTicketRepository } from "../../../domain/repositories/support-ticket.repository.interface";
import { SUPPORT_TICKET_REPOSITORY } from "../../../domain/repositories/support-ticket.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import { SupportTicketEntity } from "../../../domain/entities/support-ticket.entity";
import { CreateSupportTicketDto } from "../../dto/support-tickets/create-support-ticket.dto";
import {
  SupportAttachmentInput,
  SupportAttachmentService,
} from "../../services/support-attachment.service";

@Injectable()
export class CreateSupportTicketUseCase {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY)
    private readonly ticketRepository: ISupportTicketRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    private readonly attachmentService: SupportAttachmentService,
  ) {}

  async execute(
    userId: string,
    companyId: string,
    dto: CreateSupportTicketDto,
    file?: SupportAttachmentInput,
  ): Promise<SupportTicketEntity> {
    const member =
      await this.companyMemberRepository.findActiveByUserAndCompany(
        userId,
        companyId,
      );
    if (!member) {
      throw new ForbiddenException("No perteneces a esta empresa");
    }

    const attachmentUrl = await this.attachmentService.upload(companyId, file);

    const ticket = SupportTicketEntity.fromCreateParams({
      companyId,
      createdById: userId,
      subject: dto.subject,
    });

    return this.ticketRepository.createWithFirstMessage(ticket, {
      authorId: userId,
      body: dto.message,
      attachmentUrl,
    });
  }
}
