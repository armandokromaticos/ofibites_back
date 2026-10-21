import { Inject, Injectable } from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import { Role } from "../../../domain/enums/role.enum";
import { assertCompanyAccess } from "../../shared/company-access.guard";

@Injectable()
export class GetCompanyMembersUseCase {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
  ) {}

  async execute(
    companyId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<CompanyMemberEntity[]> {
    await assertCompanyAccess(callerUserId, callerRole, companyId, {
      companyMemberRepository: this.memberRepository,
    });
    const { data } = await this.memberRepository.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    return data;
  }
}
