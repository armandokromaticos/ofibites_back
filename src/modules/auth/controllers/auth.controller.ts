import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "../../../core/domain/enums/role.enum";
import { UpdateMeDto } from "../../../core/application/dto/auth/update-me.dto";
import { ChangePasswordDto } from "../../../core/application/dto/auth/change-password.dto";
import { UpdateMeUseCase } from "../../../core/application/use-cases/auth/update-me.use-case";
import { ChangePasswordUseCase } from "../../../core/application/use-cases/auth/change-password.use-case";
import { UploadAvatarUseCase } from "../../../core/application/use-cases/auth/upload-avatar.use-case";
import { DeleteAvatarUseCase } from "../../../core/application/use-cases/auth/delete-avatar.use-case";
import { AVATAR_MAX_BYTES } from "../../../core/application/use-cases/auth/avatar-storage";
import { parseOptionalCompanyIdHeader } from "../../../core/application/shared/company-id-header.util";
import { RolesGuard } from "../guards/roles.guard";
import { UserThrottlerGuard } from "../guards/user-throttler.guard";
import { Roles } from "../decorators/roles.decorator";
import { strictBodyPipe } from "../strict-body.pipe";
import { LoginDto } from "../../../core/application/dto/auth/login.dto";
import { RefreshTokenDto } from "../../../core/application/dto/auth/refresh-token.dto";
import { AuthResponseDto } from "../../../core/application/dto/auth/auth-response.dto";
import { MeResponseDto } from "../../../core/application/dto/auth/me-response.dto";
import { LoginUseCase } from "../../../core/application/use-cases/auth/login.use-case";
import { RefreshTokenUseCase } from "../../../core/application/use-cases/auth/refresh-token.use-case";
import { LogoutUseCase } from "../../../core/application/use-cases/auth/logout.use-case";
import { GetMeUseCase } from "../../../core/application/use-cases/auth/get-me.use-case";
import { ForgotPasswordDto } from "../../../core/application/dto/auth/forgot-password.dto";
import { ResetPasswordDto } from "../../../core/application/dto/auth/reset-password.dto";
import { ForgotPasswordUseCase } from "../../../core/application/use-cases/auth/forgot-password.use-case";
import { ResetPasswordUseCase } from "../../../core/application/use-cases/auth/reset-password.use-case";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  AUTH_THROTTLE_TTL_MS,
  CHANGE_PASSWORD_THROTTLE_LIMIT,
  FORGOT_PASSWORD_THROTTLE_LIMIT,
  RESET_PASSWORD_THROTTLE_LIMIT,
} from "../auth-throttle.constants";
import { CurrentUser } from "../decorators/current-user.decorator";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

// "Cualquier usuario autenticado y activo": RolesGuard solo resuelve `user.id`
// desde la BD (JwtAuthGuard deja únicamente authId/email).
const ALL_ROLES = Object.values(Role);

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly uploadAvatarUseCase: UploadAvatarUseCase,
    private readonly deleteAvatarUseCase: DeleteAvatarUseCase,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesión" })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refrescar tokens" })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.refreshTokenUseCase.execute(dto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cerrar sesión" })
  async logout(@Headers("authorization") auth: string): Promise<void> {
    const token = auth?.replace("Bearer ", "");
    await this.logoutUseCase.execute(token);
  }

  @Post("forgot-password")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: FORGOT_PASSWORD_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Solicitar el correo de recuperación de contraseña",
    description:
      "Responde siempre 204, exista o no la cuenta. Solo envía el correo si el email pertenece a un usuario activo con cuenta en Auth (envío en segundo plano, con enfriamiento de 60 s por correo). 429 solo por el límite por IP (5 cada 15 min).",
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.forgotPasswordUseCase.execute(dto);
  }

  @Post("reset-password")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: RESET_PASSWORD_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Restablecer la contraseña con el enlace de recuperación",
    description:
      "Recibe el access_token de la sesión de recuperación de Supabase y la nueva contraseña. Exige que el token venga de un enlace de recuperación de hace menos de 1 h (claim amr). Cierra todas las sesiones del usuario. 401 si el enlace no es válido o venció; 429 por el límite por IP (10 cada 15 min).",
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPasswordUseCase.execute(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Obtener usuario autenticado y sus empresas",
    description:
      "Devuelve el perfil del usuario y la lista de empresas a las que pertenece (memberships) con su rol funcional, sede, departamento y permisos por empresa.",
  })
  async me(@CurrentUser() user: { authId: string }): Promise<MeResponseDto> {
    return this.getMeUseCase.execute(user.authId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Actualizar mi perfil (nombre, teléfono y cargo)",
    description:
      "Edita name/phone del usuario del token y, si viene position, el cargo de su membresía activa en la empresa de X-Company-Id. Al menos un campo. Devuelve la misma forma que GET /auth/me.",
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description: "Obligatorio solo si se envía position.",
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiResponse({
    status: 400,
    description:
      "Validación, cuerpo sin campos, position sin X-Company-Id o X-Company-Id inválido.",
  })
  @ApiResponse({
    status: 403,
    description:
      "Usuario desactivado o sin membresía activa en X-Company-Id (si se envía position).",
  })
  @ApiBody({ type: UpdateMeDto })
  async updateMe(
    // Record (no UpdateMeDto): ver strictBodyPipe; llega ya como UpdateMeDto.
    @Body(strictBodyPipe(UpdateMeDto)) dto: Record<string, unknown>,
    @CurrentUser() user: { id: string; authId: string },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<MeResponseDto> {
    const companyId = parseOptionalCompanyIdHeader(companyIdHeader);
    return this.updateMeUseCase.execute(
      { id: user.id, authId: user.authId },
      dto as UpdateMeDto,
      companyId,
    );
  }

  @Post("me/avatar")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  // Tope de multer al doble del máximo para no cargar en memoria archivos
  // enormes; el límite real (2 MB, 400 con mensaje propio) lo aplica el use-case.
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: AVATAR_MAX_BYTES * 2 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
      required: ["file"],
    },
  })
  @ApiOperation({
    summary: "Subir o reemplazar mi foto de perfil",
    description:
      "Campo file: JPG o PNG (comprobado por los bytes), máximo 2.000.000 bytes. Se guarda en el bucket avatars y se borra la foto anterior. Devuelve la misma forma que GET /auth/me.",
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiResponse({
    status: 400,
    description:
      "Sin archivo, formato no permitido, contenido que no es imagen o más de 2 MB.",
  })
  @ApiResponse({ status: 413, description: "Archivo de más de 4 MB." })
  @ApiResponse({ status: 503, description: "Storage no disponible." })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string; authId: string },
  ): Promise<MeResponseDto> {
    return this.uploadAvatarUseCase.execute(
      { id: user.id, authId: user.authId },
      file
        ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size }
        : undefined,
    );
  }

  @Delete("me/avatar")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Quitar mi foto de perfil",
    description:
      "Pone avatarUrl en null y borra el archivo del bucket. Idempotente. Devuelve la misma forma que GET /auth/me.",
  })
  @ApiOkResponse({ type: MeResponseDto })
  async deleteAvatar(
    @CurrentUser() user: { id: string; authId: string },
  ): Promise<MeResponseDto> {
    return this.deleteAvatarUseCase.execute({
      id: user.id,
      authId: user.authId,
    });
  }

  @Post("change-password")
  // Throttle por IP (antes del JWT) y por usuario (después), mismos límites.
  @UseGuards(ThrottlerGuard, JwtAuthGuard, UserThrottlerGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  @Throttle({
    default: {
      limit: CHANGE_PASSWORD_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL_MS,
    },
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Cambiar mi contraseña",
    description:
      "Verifica la contraseña actual, aplica la nueva (misma política que reset-password), marca passwordChangedAt y cierra las demás sesiones (la actual sigue válida). Contraseña actual incorrecta → 400, no 401. 429 por el límite por IP o por usuario (10 cada 15 min cada uno).",
  })
  @ApiResponse({ status: 204, description: "Contraseña cambiada." })
  @ApiResponse({
    status: 400,
    description:
      "Política no cumplida, contraseña actual incorrecta o nueva igual a la actual.",
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: string; authId: string; email: string },
    @Headers("authorization") auth: string,
  ): Promise<void> {
    const token = auth.replace(/^Bearer\s+/i, "");
    await this.changePasswordUseCase.execute(
      { id: user.id, authId: user.authId, email: user.email },
      token,
      dto,
    );
  }
}
