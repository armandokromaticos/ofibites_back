import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { USER_REPOSITORY } from "../../core/domain/repositories/user.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../core/domain/repositories/company-member.repository.interface";
import { COMPANY_REPOSITORY } from "../../core/domain/repositories/company.repository.interface";
import { UserRepository } from "../../core/infrastructure/repositories/user.repository";
import { CompanyMemberRepository } from "../../core/infrastructure/repositories/company-member.repository";
import { CompanyRepository } from "../../core/infrastructure/repositories/company.repository";
import { LoginUseCase } from "../../core/application/use-cases/auth/login.use-case";
import { RefreshTokenUseCase } from "../../core/application/use-cases/auth/refresh-token.use-case";
import { LogoutUseCase } from "../../core/application/use-cases/auth/logout.use-case";
import { GetMeUseCase } from "../../core/application/use-cases/auth/get-me.use-case";
import { ForgotPasswordUseCase } from "../../core/application/use-cases/auth/forgot-password.use-case";
import { ResetPasswordUseCase } from "../../core/application/use-cases/auth/reset-password.use-case";
import {
  AUTH_THROTTLE_TTL_MS,
  RESET_PASSWORD_THROTTLE_LIMIT,
} from "./auth-throttle.constants";
import { AuthController } from "./controllers/auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { CompanyRoleGuard } from "./guards/company-role.guard";
import { PlatformOrCompanyRoleGuard } from "./guards/platform-or-company-role.guard";

@Module({
  imports: [
    // Solo aplica donde se usa @UseGuards(ThrottlerGuard) (forgot/reset-password).
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: AUTH_THROTTLE_TTL_MS,
          limit: RESET_PASSWORD_THROTTLE_LIMIT,
        },
      ],
      errorMessage:
        "Demasiados intentos desde esta conexión. Espera unos minutos e inténtalo de nuevo.",
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: COMPANY_MEMBER_REPOSITORY,
      useClass: CompanyMemberRepository,
    },
    {
      provide: COMPANY_REPOSITORY,
      useClass: CompanyRepository,
    },
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetMeUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    JwtAuthGuard,
    RolesGuard,
    CompanyRoleGuard,
    PlatformOrCompanyRoleGuard,
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    CompanyRoleGuard,
    PlatformOrCompanyRoleGuard,
    USER_REPOSITORY,
    COMPANY_MEMBER_REPOSITORY,
  ],
})
export class AuthModule {}
