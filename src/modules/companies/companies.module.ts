import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompaniesController } from "./controllers/companies.controller";
import { CompanyClientOnboardingController } from "./controllers/company-client-onboarding.controller";
import { COMPANY_REPOSITORY } from "../../core/domain/repositories/company.repository.interface";
import { CompanyRepository } from "../../core/infrastructure/repositories/company.repository";
import { COMPANY_ADDRESS_REPOSITORY } from "../../core/domain/repositories/company-address.repository.interface";
import { CompanyAddressRepository } from "../../core/infrastructure/repositories/company-address.repository";
import { CreateCompanyUseCase } from "../../core/application/use-cases/companies/create-company.use-case";
import { GetCompanyUseCase } from "../../core/application/use-cases/companies/get-company.use-case";
import { GetCompaniesUseCase } from "../../core/application/use-cases/companies/get-companies.use-case";
import { UpdateCompanyUseCase } from "../../core/application/use-cases/companies/update-company.use-case";
import { SetCompanyActiveUseCase } from "../../core/application/use-cases/companies/set-company-active.use-case";
import { DeleteCompanyUseCase } from "../../core/application/use-cases/companies/delete-company.use-case";
import { UpdateCompanyFiscalDataUseCase } from "../../core/application/use-cases/companies/update-company-fiscal-data.use-case";
import { CompleteCompanyOnboardingUseCase } from "../../core/application/use-cases/companies/complete-company-onboarding.use-case";

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController, CompanyClientOnboardingController],
  providers: [
    { provide: COMPANY_REPOSITORY, useClass: CompanyRepository },
    // T-34a: CompleteCompanyOnboardingUseCase cuenta las sedes. No se importa
    // CompanyAddressesModule porque este ya importa CompaniesModule (ciclo).
    {
      provide: COMPANY_ADDRESS_REPOSITORY,
      useClass: CompanyAddressRepository,
    },
    CreateCompanyUseCase,
    GetCompanyUseCase,
    GetCompaniesUseCase,
    UpdateCompanyUseCase,
    SetCompanyActiveUseCase,
    DeleteCompanyUseCase,
    UpdateCompanyFiscalDataUseCase,
    CompleteCompanyOnboardingUseCase,
  ],
  exports: [COMPANY_REPOSITORY, CreateCompanyUseCase],
})
export class CompaniesModule {}
