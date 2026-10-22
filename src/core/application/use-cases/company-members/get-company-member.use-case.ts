import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import { Role } from "../../../domain/enums/role.enum";
import { assertCompanyAccess } from "../../shared/company-access.guard";

@Injectable()
export class GetCompanyMemberUseCase {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
  ) {}

  async execute(
    companyId: string,
    id: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<CompanyMemberEntity> {
    await assertCompanyAccess(callerUserId, callerRole, companyId, {
      companyMemberRepository: this.memberRepository,
    });
    const member = await this.memberRepository.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException(
        `Member ${id} not found in company ${companyId}`,
      );
    }
    return member;
  }
}
