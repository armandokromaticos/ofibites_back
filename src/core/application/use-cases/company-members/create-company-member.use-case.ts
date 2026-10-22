import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import { BRANCH_REPOSITORY } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import { DEPARTMENT_REPOSITORY } from "../../../domain/repositories/department.repository.interface";
import { CreateCompanyMemberDto } from "../../dto/company-members/create-company-member.dto";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";

@Injectable()
export class CreateCompanyMemberUseCase {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: IBranchRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: IDepartmentRepository,
  ) {}

  async execute(
    companyId: string,
    dto: CreateCompanyMemberDto,
  ): Promise<CompanyMemberEntity> {
    const company = await this.companyRepository.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const user = await this.userRepository.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    if (dto.branchId) {
      const branch = await this.branchRepository.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch || branch.companyId !== companyId) {
        throw new BadRequestException(
          `Branch ${dto.branchId} does not belong to company ${companyId}`,
        );
      }
    }

    if (dto.departmentId) {
      const department = await this.departmentRepository.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department || department.companyId !== companyId) {
        throw new BadRequestException(
          `Department ${dto.departmentId} does not belong to company ${companyId}`,
        );
      }
    }

    const entity = CompanyMemberEntity.fromCreateParams({
      userId: dto.userId,
      companyId,
      role: dto.role,
      position: dto.position ?? null,
      branchId: dto.branchId ?? null,
      departmentId: dto.departmentId ?? null,
      canPayInvoices: dto.canPayInvoices,
      isActive: dto.isActive,
    });

    try {
      const created = await this.memberRepository.create(entity);
      // Ya tenemos el User a mano (lo buscamos arriba): evita pedir el
      // include de nuevo al repositorio solo para esto.
      created.userName = user.name;
      created.userEmail = user.email;
      created.userPhone = user.phone;
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(`El usuario ya es miembro de esta empresa`);
      }
      throw error;
    }
  }
}
