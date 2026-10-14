import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SupportMessageEntity } from "../../../domain/entities/support-message.entity";

export class SupportMessageAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;
}

export class SupportMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ticketId: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  body: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  attachmentUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: SupportMessageAuthorDto, nullable: true })
  author: SupportMessageAuthorDto | null;

  static fromEntity(entity: SupportMessageEntity): SupportMessageResponseDto {
    const dto = new SupportMessageResponseDto();
    dto.id = entity.id;
    dto.ticketId = entity.ticketId;
    dto.authorId = entity.authorId;
    dto.body = entity.body;
    dto.attachmentUrl = entity.attachmentUrl;
    dto.createdAt = entity.createdAt;
    dto.author = entity.author ?? null;
    return dto;
  }
}
