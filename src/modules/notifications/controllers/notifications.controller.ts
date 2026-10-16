import {
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "../../../core/domain/enums/role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { GetNotificationsQueryDto } from "../../../core/application/dto/notifications/get-notifications-query.dto";
import {
  MarkAllNotificationsReadResponseDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from "../../../core/application/dto/notifications/notification-response.dto";
import { GetNotificationsUseCase } from "../../../core/application/use-cases/notifications/get-notifications.use-case";
import { MarkNotificationReadUseCase } from "../../../core/application/use-cases/notifications/mark-notification-read.use-case";
import { MarkAllNotificationsReadUseCase } from "../../../core/application/use-cases/notifications/mark-all-notifications-read.use-case";
import { parseOptionalCompanyIdHeader } from "../../../core/application/shared/company-id-header.util";
import { notificationIdPipe } from "../notification-id.pipe";

// Cualquier usuario autenticado y activo: RolesGuard solo se usa para resolver
// `user.id` desde la BD (JwtAuthGuard deja únicamente authId/email).
const ALL_ROLES = Object.values(Role);

const COMPANY_HEADER_DOC = {
  name: "X-Company-Id",
  required: false,
  description:
    "Opcional. Si se envía, limita a las notificaciones de esa empresa más las que no tienen empresa.",
};

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL_ROLES)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly getNotificationsUseCase: GetNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Listar mis notificaciones (más recientes primero) con el total sin leer",
  })
  @ApiHeader(COMPANY_HEADER_DOC)
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiResponse({ status: 400, description: "Query o X-Company-Id inválidos." })
  async findMine(
    @Query() query: GetNotificationsQueryDto,
    @CurrentUser() user: { id: string },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<NotificationListResponseDto> {
    const companyId = parseOptionalCompanyIdHeader(companyIdHeader);
    const result = await this.getNotificationsUseCase.execute(
      user.id,
      query,
      companyId,
    );
    const response = new NotificationListResponseDto();
    response.data = result.data.map((n) => n.toResponseDto());
    response.total = result.total;
    response.unreadCount = result.unreadCount;
    return response;
  }

  // Declarada antes que ":id/read" por claridad (no colisionan: distinto nº de segmentos).
  @Patch("read-all")
  @ApiOperation({ summary: "Marcar como leídas todas mis notificaciones" })
  @ApiHeader(COMPANY_HEADER_DOC)
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  async markAllRead(
    @CurrentUser() user: { id: string },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    const companyId = parseOptionalCompanyIdHeader(companyIdHeader);
    const { updated } = await this.markAllNotificationsReadUseCase.execute(
      user.id,
      companyId,
    );
    const response = new MarkAllNotificationsReadResponseDto();
    response.updated = updated;
    return response;
  }

  @Patch(":id/read")
  @ApiOperation({
    summary: "Marcar una notificación como leída (idempotente)",
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiResponse({
    status: 404,
    description: "No existe o no es del usuario.",
  })
  async markRead(
    @Param("id", notificationIdPipe()) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<NotificationResponseDto> {
    const entity = await this.markNotificationReadUseCase.execute(id, user.id);
    return entity.toResponseDto();
  }
}
