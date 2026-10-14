import { Prisma, SupportMessage as PrismaSupportMessage } from "@prisma/client";

export interface SupportMessageAuthorInfo {
  id: string;
  name: string;
  role: string;
}

export interface CreateSupportMessageParams {
  ticketId: string;
  authorId: string;
  body: string;
  attachmentUrl?: string | null;
}

type PrismaSupportMessageWithRelations = PrismaSupportMessage & {
  author?: { id: string; name: string; role: string } | null;
};

export class SupportMessageEntity {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: Date;
  author?: SupportMessageAuthorInfo;

  static fromPrisma(
    prisma: PrismaSupportMessageWithRelations,
  ): SupportMessageEntity {
    const entity = new SupportMessageEntity();
    entity.id = prisma.id;
    entity.ticketId = prisma.ticketId;
    entity.authorId = prisma.authorId;
    entity.body = prisma.body;
    entity.attachmentUrl = prisma.attachmentUrl;
    entity.createdAt = prisma.createdAt;
    if (prisma.author) {
      entity.author = {
        id: prisma.author.id,
        name: prisma.author.name,
        role: prisma.author.role,
      };
    }
    return entity;
  }

  static fromCreateParams(
    params: CreateSupportMessageParams,
  ): SupportMessageEntity {
    const body = params.body.trim();
    if (body.length === 0) {
      throw new Error("body cannot be empty");
    }
    const entity = new SupportMessageEntity();
    entity.id = "";
    entity.ticketId = params.ticketId;
    entity.authorId = params.authorId;
    entity.body = body;
    entity.attachmentUrl = params.attachmentUrl ?? null;
    entity.createdAt = new Date();
    return entity;
  }

  toPrismaCreate(): Prisma.SupportMessageUncheckedCreateInput {
    return {
      ticketId: this.ticketId,
      authorId: this.authorId,
      body: this.body,
      attachmentUrl: this.attachmentUrl,
    };
  }
}
