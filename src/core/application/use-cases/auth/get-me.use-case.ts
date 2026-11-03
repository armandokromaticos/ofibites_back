import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { MembershipDto, MeResponseDto } from "../../dto/auth/me-response.dto";

@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  async execute(authId: string): Promise<MeResponseDto> {
    if (!authId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const user = await this.userRepository.findUnique({ where: { authId } });
    if (!user) {
      throw new ForbiddenException("Usuario no encontrado");
    }

    const memberships =
      await this.companyMemberRepository.findAllByUserIdWithRefs(user.id);

    const response = new MeResponseDto();
    response.user = user.toResponse();
    response.memberships = memberships.map((membership) => {
      const dto = new MembershipDto();
      dto.companyId = membership.companyId;
      dto.companyName = membership.companyName;
      dto.companyIsActive = membership.companyIsActive;
      dto.onboardingCompletedAt =
        membership.companyOnboardingCompletedAt?.toISOString() ?? null;
      dto.role = membership.role;
      dto.position = membership.position;
      dto.branchId = membership.branchId;
      dto.branchName = membership.branchName;
      dto.departmentId = membership.departmentId;
      dto.departmentName = membership.departmentName;
      dto.canPayInvoices = membership.canPayInvoices;
      dto.isActive = membership.isActive;
      return dto;
    });

    return response;
  }
}
