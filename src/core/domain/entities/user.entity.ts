import { Prisma, User as PrismaUser } from "@prisma/client";
import { Role } from "../enums/role.enum";
import { UserResponseDto } from "../../application/dto/users/user-response.dto";

export interface CreateUserParams {
  authId: string | null;
  email: string;
  name: string;
  phone?: string | null;
  birthDate?: Date | null;
  role?: Role;
  isActive?: boolean;
}

export class UserEntity {
  id: string;
  authId: string | null;
  email: string;
  name: string;
  phone: string | null;
  birthDate: Date | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt: Date | null;

  static fromPrisma(prismaUser: PrismaUser): UserEntity {
    const entity = new UserEntity();
    entity.id = prismaUser.id;
    entity.authId = prismaUser.authId;
    entity.email = prismaUser.email;
    entity.name = prismaUser.name;
    entity.phone = prismaUser.phone;
    entity.birthDate = prismaUser.birthDate;
    if (!Object.values(Role).includes(prismaUser.role as Role)) {
      throw new Error(`Invalid role value: ${prismaUser.role}`);
    }
    entity.role = prismaUser.role as Role;
    entity.isActive = prismaUser.isActive;
    entity.createdAt = prismaUser.createdAt;
    entity.updatedAt = prismaUser.updatedAt;
    entity.passwordChangedAt = prismaUser.passwordChangedAt ?? null;
    return entity;
  }

  static fromCreateParams(params: CreateUserParams): UserEntity {
    const entity = new UserEntity();
    entity.id = "";
    entity.authId = params.authId;
    entity.email = params.email;
    entity.name = params.name;
    entity.phone = params.phone ?? null;
    entity.birthDate = params.birthDate ?? null;
    entity.role = params.role ?? Role.CLIENT;
    entity.isActive = params.isActive ?? true;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    entity.passwordChangedAt = null;
    return entity;
  }

  toPrismaCreate(): Prisma.UserCreateInput {
    return {
      authId: this.authId,
      email: this.email,
      name: this.name,
      phone: this.phone,
      birthDate: this.birthDate,
      role: this.role,
      isActive: this.isActive,
    };
  }

  toResponse(): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = this.id;
    dto.authId = this.authId;
    dto.email = this.email;
    dto.name = this.name;
    dto.phone = this.phone;
    dto.birthDate = this.birthDate
      ? `${this.birthDate.getUTCFullYear()}-${String(this.birthDate.getUTCMonth() + 1).padStart(2, "0")}-${String(this.birthDate.getUTCDate()).padStart(2, "0")}`
      : null;
    dto.role = this.role;
    dto.isActive = this.isActive;
    dto.createdAt = this.createdAt;
    dto.updatedAt = this.updatedAt;
    dto.passwordChangedAt = this.passwordChangedAt;
    return dto;
  }
}
