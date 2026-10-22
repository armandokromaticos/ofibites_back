import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompaniesModule } from "../companies/companies.module";
import { BranchesModule } from "../branches/branches.module";
import { DepartmentsModule } from "../departments/departments.module";
import { CompanyMembersController } from "./controllers/company-members.controller";
import { CreateCompanyMemberUseCase } from "../../core/application/use-cases/company-members/create-company-member.use-case";
import { InviteCompanyMemberUseCase } from "../../core/application/use-cases/company-members/invite-company-member.use-case";
import { GetCompanyMemberUseCase } from "../../core/application/use-cases/company-members/get-company-member.use-case";
import { GetCompanyMembersUseCase } from "../../core/application/use-cases/company-members/get-company-members.use-case";
import { UpdateCompanyMemberUseCase } from "../../core/application/use-cases/company-members/update-company-member.use-case";
import { DeleteCompanyMemberUseCase } from "../../core/application/use-cases/company-members/delete-company-member.use-case";
import { ResendCompanyMemberInviteUseCase } from "../../core/application/use-cases/company-members/resend-company-member-invite.use-case";
import { ResetCompanyMemberPasswordUseCase } from "../../core/application/use-cases/company-members/reset-company-member-password.use-case";

@Module({
  imports: [AuthModule, CompaniesModule, BranchesModule, DepartmentsModule],
  controllers: [CompanyMembersController],
  providers: [
    CreateCompanyMemberUseCase,
    InviteCompanyMemberUseCase,
    GetCompanyMemberUseCase,
    GetCompanyMembersUseCase,
    UpdateCompanyMemberUseCase,
    DeleteCompanyMemberUseCase,
    ResendCompanyMemberInviteUseCase,
    ResetCompanyMemberPasswordUseCase,
  ],
  exports: [InviteCompanyMemberUseCase],
})
export class CompanyMembersModule {}
