import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { IUserRepository } from "../../domain/repositories/user.repository.interface";
import { UserEntity } from "../../domain/entities/user.entity";
import { AuthUserCacheService } from "../cache/auth-user-cache.service";

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUserCache: AuthUserCacheService,
  ) {}

  async create(entity: UserEntity): Promise<UserEntity> {
    const created = await this.prisma.user.create({
      data: entity.toPrismaCreate(),
    });
    return UserEntity.fromPrisma(created);
  }

  async findUnique(
    args: Prisma.UserFindUniqueArgs,
  ): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique(args);
    return user ? UserEntity.fromPrisma(user) : null;
  }

  async findMany(
    args?: Prisma.UserFindManyArgs,
  ): Promise<{ data: UserEntity[]; total?: number }> {
    const rows = await this.prisma.user.findMany(args);
    const data = rows.map((row) => UserEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";

    if (hasPagination) {
      const total = await this.prisma.user.count({ where: args?.where });
      return { data, total };
    }

    return { data };
  }

  async update(args: Prisma.UserUpdateArgs): Promise<UserEntity> {
    const updated = await this.prisma.user.update(args);
    // Rol o estado pueden haber cambiado: que los guards relean de la BD.
    this.authUserCache.invalidar(updated.authId);
    return UserEntity.fromPrisma(updated);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.prisma.user.delete({ where: { id } });
    this.authUserCache.invalidar(deleted.authId);
    // Borra en cascada sus membresías.
    this.authUserCache.invalidarMembresias();
  }

  async exists(args: Prisma.UserCountArgs): Promise<boolean> {
    const count = await this.prisma.user.count(args);
    return count > 0;
  }

  async markPasswordChangedByAuthId(authId: string, at: Date): Promise<void> {
    await this.prisma.user.updateMany({
      where: { authId },
      data: { passwordChangedAt: at },
    });
  }
}
