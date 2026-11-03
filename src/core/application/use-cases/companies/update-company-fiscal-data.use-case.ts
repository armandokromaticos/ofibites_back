import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { CompanyEntity } from "../../../domain/entities/company.entity";
import { UpdateCompanyFiscalDataDto } from "../../dto/companies/update-company-fiscal-data.dto";
import { assertCompanyActive } from "../../shared/company-active.guard";

/**
 * T-34a: paso 1 del onboarding. El COMPANY_ADMIN (o un admin de plataforma)
 * edita la dirección fiscal y, opcionalmente, el nombre fiscal. La razón
 * social y el RIF no son editables por esta vía.
 */
@Injectable()
export class UpdateCompanyFiscalDataUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(
    companyId: string,
    dto: UpdateCompanyFiscalDataDto,
  ): Promise<CompanyEntity> {
    // 404 si no existe, 403 si está desactivada.
    await assertCompanyActive(companyId, {
      companyRepository: this.companyRepository,
    });

    const data: Prisma.CompanyUpdateInput = {
      fiscalAddress: dto.fiscalAddress.trim(),
    };
    if (dto.fiscalName !== undefined) {
      data.fiscalName = dto.fiscalName?.trim() || null;
    }

    try {
      return await this.companyRepository.update({
        where: { id: companyId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Empresa no encontrada");
      }
      throw error;
    }
  }
}
