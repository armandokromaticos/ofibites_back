import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { Role } from "../../../core/domain/enums/role.enum";
import { TicketStatus } from "../../../core/domain/enums/ticket-status.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CreateSupportTicketDto } from "../../../core/application/dto/support-tickets/create-support-ticket.dto";
import { AddSupportMessageDto } from "../../../core/application/dto/support-tickets/add-support-message.dto";
import { UpdateTicketStatusDto } from "../../../core/application/dto/support-tickets/update-ticket-status.dto";
import { SupportTicketResponseDto } from "../../../core/application/dto/support-tickets/support-ticket-response.dto";
import { SupportAttachmentInput } from "../../../core/application/services/support-attachment.service";
import { CreateSupportTicketUseCase } from "../../../core/application/use-cases/support-tickets/create-support-ticket.use-case";
import { GetSupportTicketsUseCase } from "../../../core/application/use-cases/support-tickets/get-support-tickets.use-case";
import { GetSupportTicketUseCase } from "../../../core/application/use-cases/support-tickets/get-support-ticket.use-case";
import { AddSupportMessageUseCase } from "../../../core/application/use-cases/support-tickets/add-support-message.use-case";
import { UpdateTicketStatusUseCase } from "../../../core/application/use-cases/support-tickets/update-ticket-status.use-case";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

@ApiTags("Support Tickets")
@Controller("support-tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportTicketsController {
  constructor(
    private readonly createSupportTicketUseCase: CreateSupportTicketUseCase,
    private readonly getSupportTicketsUseCase: GetSupportTicketsUseCase,
    private readonly getSupportTicketUseCase: GetSupportTicketUseCase,
    private readonly addSupportMessageUseCase: AddSupportMessageUseCase,
    private readonly updateTicketStatusUseCase: UpdateTicketStatusUseCase,
  ) {}

  @Post()
  @Roles(Role.CLIENT)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiHeader({
    name: "X-Company-Id",
    required: true,
    description: "Empresa desde la que se abre el reporte.",
  })
  @ApiOperation({
    summary:
      "Crear reporte de soporte con su primer mensaje y archivo opcional",
  })
  async create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: { id: string },
    @Headers("x-company-id") companyIdHeader?: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SupportTicketResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    const ticket = await this.createSupportTicketUseCase.execute(
      user.id,
      companyId,
      dto,
      this.toAttachment(file),
    );
    return SupportTicketResponseDto.fromEntity(ticket);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({
    summary:
      "Listar reportes (CLIENT solo los de sus empresas; admin todos). Filtros opcionales.",
  })
  @ApiQuery({ name: "status", required: false, enum: TicketStatus })
  @ApiQuery({
    name: "companyId",
    required: false,
    description: "Solo admin: acota a una empresa concreta.",
  })
  async findAll(
    @CurrentUser() user: { id: string; role: Role },
    @Query("status") status?: string,
    @Query("companyId") companyId?: string,
  ): Promise<SupportTicketResponseDto[]> {
    const tickets = await this.getSupportTicketsUseCase.execute(
      user.id,
      user.role,
      {
        status: this.parseStatus(status),
        companyId: this.parseOptionalUuid(companyId, "companyId"),
      },
    );
    return tickets.map((ticket) => SupportTicketResponseDto.fromEntity(ticket));
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Detalle del reporte con su chat completo" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.getSupportTicketUseCase.execute(
      id,
      user.id,
      user.role,
    );
    return SupportTicketResponseDto.fromEntity(ticket);
  }

  @Post(":id/messages")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Responder en el chat del reporte (archivo opcional)",
  })
  async addMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddSupportMessageDto,
    @CurrentUser() user: { id: string; role: Role },
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.addSupportMessageUseCase.execute(
      id,
      user.id,
      user.role,
      dto,
      this.toAttachment(file),
    );
    return SupportTicketResponseDto.fromEntity(ticket);
  }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: "Cambiar estado del reporte (admin Ofibites)" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<SupportTicketResponseDto> {
    const ticket = await this.updateTicketStatusUseCase.execute(id, dto.status);
    return SupportTicketResponseDto.fromEntity(ticket);
  }

  private toAttachment(
    file?: Express.Multer.File,
  ): SupportAttachmentInput | undefined {
    if (!file) {
      return undefined;
    }
    return {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    };
  }

  private requireCompanyId(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException("Falta el header X-Company-Id");
    }
    if (!isUUID(trimmed, "4")) {
      throw new BadRequestException("X-Company-Id debe ser un UUID válido");
    }
    return trimmed;
  }

  private parseOptionalUuid(
    value: string | undefined,
    field: string,
  ): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!isUUID(trimmed, "4")) {
      throw new BadRequestException(`${field} debe ser un UUID válido`);
    }
    return trimmed;
  }

  private parseStatus(value: string | undefined): TicketStatus | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!Object.values(TicketStatus).includes(trimmed as TicketStatus)) {
      throw new BadRequestException(
        `status inválido. Valores: ${Object.values(TicketStatus).join(", ")}`,
      );
    }
    return trimmed as TicketStatus;
  }
}
