import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import { BRANCH_REPOSITORY } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import { DEPARTMENT_REPOSITORY } from "../../../domain/repositories/department.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { UpdateCompanyMemberDto } from "../../dto/company-members/update-company-member.dto";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import { UserEntity } from "../../../domain/entities/user.entity";

@Injectable()
export class UpdateCompanyMemberUseCase {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: IBranchRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: IDepartmentRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    companyId: string,
    id: string,
    dto: UpdateCompanyMemberDto,
  ): Promise<CompanyMemberEntity> {
    const hasUpdates = Object.values(dto).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new BadRequestException("No fields provided for update");
    }

    const existing = await this.memberRepository.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(
        `Member ${id} not found in company ${companyId}`,
      );
    }

    // Solo validamos cuando viene un id no-null (string vacío sería un input inválido,
    // no una intención de desconectar — eso se expresa con null explícito).
    if (dto.branchId !== undefined && dto.branchId !== null) {
      if (dto.branchId.length === 0) {
        throw new BadRequestException(
          "branchId no puede ser una cadena vacía; usa null para desconectar",
        );
      }
      const branch = await this.branchRepository.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch || branch.companyId !== companyId) {
        throw new BadRequestException(
          `Branch ${dto.branchId} does not belong to company ${companyId}`,
        );
      }
    }

    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      if (dto.departmentId.length === 0) {
        throw new BadRequestException(
          "departmentId no puede ser una cadena vacía; usa null para desconectar",
        );
      }
      const department = await this.departmentRepository.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department || department.companyId !== companyId) {
        throw new BadRequestException(
          `Department ${dto.departmentId} does not belong to company ${companyId}`,
        );
      }
    }

    const data: Prisma.CompanyMemberUpdateInput = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.canPayInvoices !== undefined) {
      data.canPayInvoices = dto.canPayInvoices;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.branchId !== undefined) {
      data.branch =
        dto.branchId === null
          ? { disconnect: true }
          : {
              connect: {
                companyId_id: { companyId, id: dto.branchId },
              },
            };
    }
    if (dto.departmentId !== undefined) {
      data.department =
        dto.departmentId === null
          ? { disconnect: true }
          : {
              connect: {
                companyId_id: { companyId, id: dto.departmentId },
              },
            };
    }

    // `@IsOptional()` de class-validator trata `null` igual que `undefined` y
    // salta el resto de validadores del campo, así que un `name: null` llega
    // intacto hasta aquí. `User.name` es NOT NULL en el schema, así que lo
    // rechazamos explícitamente en vez de dejar que Prisma lance un error
    // genérico (mismo estilo que el chequeo de branchId/departmentId arriba).
    if (dto.name === null) {
      throw new BadRequestException("name no puede ser null");
    }

    // El correo no se puede cambiar por aquí (decisión de diseño); nombre y
    // teléfono viven en User, no en CompanyMember, así que se actualizan en
    // dos awaits secuenciales (no hay precedente de $transaction cruzando
    // tablas en este repo fuera del checkout).
    let user: UserEntity | null = null;
    if (dto.name !== undefined || dto.phone !== undefined) {
      const userData: Prisma.UserUpdateInput = {};
      if (dto.name !== undefined) userData.name = dto.name;
      if (dto.phone !== undefined) userData.phone = dto.phone;
      user = await this.userRepository.update({
        where: { id: existing.userId },
        data: userData,
      });
    }

    let updatedMember: CompanyMemberEntity;
    try {
      updatedMember = await this.memberRepository.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `Member ${id} not found in company ${companyId}`,
        );
      }
      throw error;
    }

    // El repositorio genérico no trae el `user` incluido en `update`: si no
    // lo tocamos arriba, lo buscamos para completar la respuesta.
    if (!user) {
      user = await this.userRepository.findUnique({
        where: { id: existing.userId },
      });
    }
    if (user) {
      updatedMember.userName = user.name;
      updatedMember.userEmail = user.email;
      updatedMember.userPhone = user.phone;
    }

    return updatedMember;
  }
}
