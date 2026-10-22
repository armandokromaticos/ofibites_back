import { Prisma } from "@prisma/client";
import { UserEntity } from "../entities/user.entity";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface IUserRepository {
  create(entity: UserEntity): Promise<UserEntity>;
  findUnique(args: Prisma.UserFindUniqueArgs): Promise<UserEntity | null>;
  findMany(
    args?: Prisma.UserFindManyArgs,
  ): Promise<{ data: UserEntity[]; total?: number }>;
  update(args: Prisma.UserUpdateArgs): Promise<UserEntity>;
  delete(id: string): Promise<void>;
  exists(args: Prisma.UserCountArgs): Promise<boolean>;
  /** Marca `passwordChangedAt`; no falla si no hay fila para ese authId. */
  markPasswordChangedByAuthId(authId: string, at: Date): Promise<void>;
}
