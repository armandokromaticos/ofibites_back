import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { InviteCompanyMemberDto } from "../../dto/company-members/invite-company-member.dto";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import { UserEntity } from "../../../domain/entities/user.entity";

const EMAIL_EXISTS_HINT =
  "Este email ya existe en la plataforma. Use POST /companies/:companyId/members con el userId existente.";

@Injectable()
export class InviteCompanyMemberUseCase {
  private readonly logger = new Logger(InviteCompanyMemberUseCase.name);

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
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(
    companyId: string,
    dto: InviteCompanyMemberDto,
  ): Promise<CompanyMemberEntity> {
    const email = dto.email.trim().toLowerCase();

    const company = await this.companyRepository.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
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

    const existingUser = await this.userRepository.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(EMAIL_EXISTS_HINT);
    }

    this.logger.log(`Invitando usuario ${email} a company ${companyId}`);
    const supabase = this.supabaseService.getAdmin();

    const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_URL?.trim();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name: dto.name },
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      this.logger.warn(
        `Error en Supabase inviteUserByEmail para ${email}: ${error.message} (code=${error.code ?? "?"})`,
      );
      if (
        error.code === "email_exists" ||
        error.code === "user_already_exists"
      ) {
        throw new ConflictException(EMAIL_EXISTS_HINT);
      }
      if (
        error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit"
      ) {
        throw new HttpException(
          "Supabase rechazó el envío por límite de tasa. Reintenta más tarde o configura un proveedor SMTP custom.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException(error.message);
    }

    const authId = data.user?.id;
    if (!authId) {
      throw new InternalServerErrorException(
        "Supabase devolvió una invitación sin authId",
      );
    }
    this.logger.log(`Usuario invitado en Auth: ${authId}`);

    let createdUser: UserEntity;
    try {
      const userEntity = UserEntity.fromCreateParams({
        authId,
        email,
        name: dto.name.trim(),
        phone: dto.phone ?? null,
      });
      createdUser = await this.userRepository.create(userEntity);
    } catch (err) {
      this.logger.error(
        `Error sincronizando user invitado en DB (${authId}), revirtiendo Auth`,
      );
      await this.tryDeleteAuthUser(authId);
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(EMAIL_EXISTS_HINT);
      }
      throw new InternalServerErrorException(
        "Error al crear el usuario en la base de datos. Se revirtió la invitación.",
      );
    }

    try {
      const memberEntity = CompanyMemberEntity.fromCreateParams({
        userId: createdUser.id,
        companyId,
        role: dto.role,
        position: dto.position ?? null,
        branchId: dto.branchId ?? null,
        departmentId: dto.departmentId ?? null,
        canPayInvoices: dto.canPayInvoices,
        isActive: true,
      });
      const created = await this.memberRepository.create(memberEntity);
      // Ya tenemos el User recién creado a mano: evita pedir el include de
      // nuevo al repositorio solo para esto.
      created.userName = createdUser.name;
      created.userEmail = createdUser.email;
      created.userPhone = createdUser.phone;
      return created;
    } catch (err) {
      this.logger.error(
        `Error creando CompanyMember para ${createdUser.id}, revirtiendo User y Auth`,
      );
      await this.tryDeleteUser(createdUser.id);
      await this.tryDeleteAuthUser(authId);
      throw err;
    }
  }

  private async tryDeleteAuthUser(authId: string): Promise<void> {
    try {
      await this.supabaseService.getAdmin().auth.admin.deleteUser(authId);
    } catch (err) {
      this.logger.error(
        `No se pudo revertir Supabase auth user ${authId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async tryDeleteUser(userId: string): Promise<void> {
    try {
      await this.userRepository.delete(userId);
    } catch (err) {
      this.logger.error(
        `No se pudo revertir DB user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
