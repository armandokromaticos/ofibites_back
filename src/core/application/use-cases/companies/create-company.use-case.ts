import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { CreateCompanyDto } from "../../dto/companies/create-company.dto";
import { CompanyEntity } from "../../../domain/entities/company.entity";
import { describeUniqueTarget } from "../../shared/prisma-error.util";

@Injectable()
export class CreateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(dto: CreateCompanyDto): Promise<CompanyEntity> {
    const entity = CompanyEntity.fromCreateParams({
      legalName: dto.legalName,
      taxId: dto.taxId,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      fiscalName: dto.fiscalName ?? null,
      fiscalAddress: dto.fiscalAddress ?? null,
      creditDays: dto.creditDays,
      creditLimit: dto.creditLimit ?? null,
      isActive: dto.isActive,
    });

    try {
      return await this.companyRepository.create(entity);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `Ya existe una empresa con el mismo ${describeUniqueTarget(error)}`,
        );
      }
      throw error;
    }
  }
}
