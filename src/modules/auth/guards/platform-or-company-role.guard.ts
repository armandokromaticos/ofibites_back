import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { Role } from "../../../core/domain/enums/role.enum";
import type { ICompanyMemberRepository } from "../../../core/domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../core/domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../core/domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../core/domain/repositories/user.repository.interface";
import { AuthUserCacheService } from "../../../core/infrastructure/cache/auth-user-cache.service";
import {
  PLATFORM_OR_COMPANY_ROLE_KEY,
  PlatformOrCompanyRoleOptions,
} from "../decorators/platform-or-company-role.decorator";

const COMPANY_ID_HEADER = "x-company-id";

interface AuthRequestUser {
  authId?: string;
  email?: string;
  id?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class PlatformOrCompanyRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<PlatformOrCompanyRoleOptions>(
        PLATFORM_OR_COMPANY_ROLE_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!options) {
      return true;
    }

    const platformRoles = options.platformRoles ?? [];
    const companyRoles = options.companyRoles ?? [];

    if (platformRoles.length === 0 && companyRoles.length === 0) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request["user"] as AuthRequestUser | undefined;

    if (!authUser?.authId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const { id: userId, role: userRole } = await this.resolveUser(
      authUser,
      request,
    );

    if (platformRoles.some((role) => userRole === role)) {
      return true;
    }

    if (companyRoles.length === 0) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }

    const companyId = this.extractCompanyId(request);

    if (!companyId) {
      throw new BadRequestException(
        "Identificador de empresa requerido para esta acción",
      );
    }

    const member =
      await this.companyMemberRepository.findActiveByUserAndCompany(
        userId,
        companyId,
      );

    if (!member) {
      throw new ForbiddenException("No perteneces a esta empresa");
    }

    const hasCompanyRole = companyRoles.some((role) => member.role === role);

    if (!hasCompanyRole) {
      throw new ForbiddenException(
        "No tienes permisos en esta empresa para esta acción",
      );
    }

    request["companyMember"] = member;

    return true;
  }

  private async resolveUser(
    authUser: AuthRequestUser,
    request: Request,
  ): Promise<{ id: string; role: Role }> {
    if (authUser.id && authUser.role) {
      if (authUser.isActive === false) {
        throw new ForbiddenException("Usuario desactivado");
      }
      return { id: authUser.id, role: authUser.role as Role };
    }

    const user = await this.authUserCache.obtener(authUser.authId!, () =>
      this.userRepository.findUnique({ where: { authId: authUser.authId } }),
    );

    if (!user) {
      throw new ForbiddenException("Usuario no encontrado");
    }

    if (!user.isActive) {
      throw new ForbiddenException("Usuario desactivado");
    }

    request["user"] = {
      ...authUser,
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    };

    return { id: user.id, role: user.role };
  }

  private extractCompanyId(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined>;
    const fromParams = params?.["companyId"];
    if (fromParams) {
      return fromParams;
    }

    const headerValue = request.headers[COMPANY_ID_HEADER];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }
}
