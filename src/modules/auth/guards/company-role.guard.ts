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
import { CompanyRole } from "../../../core/domain/enums/company-role.enum";
import type { ICompanyMemberRepository } from "../../../core/domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../core/domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../core/domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../core/domain/repositories/user.repository.interface";
import { AuthUserCacheService } from "../../../core/infrastructure/cache/auth-user-cache.service";
import { COMPANY_ROLES_KEY } from "../decorators/company-roles.decorator";

const COMPANY_ID_HEADER = "x-company-id";

interface AuthRequestUser {
  authId?: string;
  email?: string;
  id?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class CompanyRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<CompanyRole[]>(
      COMPANY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request["user"] as AuthRequestUser | undefined;

    if (!authUser?.authId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const companyIdHeader = request.headers[COMPANY_ID_HEADER];
    const companyId = Array.isArray(companyIdHeader)
      ? companyIdHeader[0]
      : companyIdHeader;

    if (!companyId) {
      throw new BadRequestException(
        "Header X-Company-Id requerido para esta acción",
      );
    }

    let userId = authUser.id;
    if (!userId) {
      const authId = authUser.authId;
      const user = await this.authUserCache.obtener(authId, () =>
        this.userRepository.findUnique({ where: { authId } }),
      );
      if (!user) {
        throw new ForbiddenException("Usuario no encontrado");
      }
      if (!user.isActive) {
        throw new ForbiddenException("Usuario desactivado");
      }
      userId = user.id;
      request["user"] = {
        ...authUser,
        id: user.id,
        role: user.role,
        isActive: user.isActive,
      };
    }

    const member = await this.authUserCache.obtenerMembresia(
      userId,
      companyId,
      () =>
        this.companyMemberRepository.findActiveByUserAndCompany(
          userId,
          companyId,
        ),
    );

    if (!member) {
      throw new ForbiddenException("No perteneces a esta empresa");
    }

    const hasRole = requiredRoles.some((role) => member.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        "No tienes permisos en esta empresa para esta acción",
      );
    }

    request["companyMember"] = member;

    return true;
  }
}
