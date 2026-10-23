import {
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
import type { IUserRepository } from "../../../core/domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../core/domain/repositories/user.repository.interface";
import { AuthUserCacheService } from "../../../core/infrastructure/cache/auth-user-cache.service";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request["user"] as { authId: string; email: string };

    if (!authUser?.authId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const user = await this.authUserCache.obtener(authUser.authId, () =>
      this.userRepository.findUnique({ where: { authId: authUser.authId } }),
    );

    if (!user) {
      throw new ForbiddenException("Usuario no encontrado");
    }

    if (!user.isActive) {
      throw new ForbiddenException("Usuario desactivado");
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }

    request["user"] = {
      ...authUser,
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    };

    return true;
  }
}
