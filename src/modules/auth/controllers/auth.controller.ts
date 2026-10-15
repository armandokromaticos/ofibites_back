import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  FORGOT_PASSWORD_THROTTLE_LIMIT,
  RESET_PASSWORD_THROTTLE_LIMIT,
} from "../auth-throttle.constants";
import { CurrentUser } from "../decorators/current-user.decorator";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

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
}
