import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { UpdateCompanyDto } from "../../dto/companies/update-company.dto";
import { CompanyEntity } from "../../../domain/entities/company.entity";
import { describeUniqueTarget } from "../../shared/prisma-error.util";
import { Role } from "../../../domain/enums/role.enum";

export const FINANCE_ADMIN_ONLY_CREDIT_LIMIT_MESSAGE =
  "Con el rol de finanzas solo puedes cambiar el cupo de crédito (creditLimit) de la empresa";

@Injectable()
export class UpdateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateCompanyDto,
    actorRole?: Role,
  ): Promise<CompanyEntity> {
    const hasUpdates = Object.values(dto).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new BadRequestException("No fields provided for update");
    }
    // T-06: FINANCE_ADMIN entra en PATCH /companies/:id solo por el cupo.
    if (actorRole === Role.FINANCE_ADMIN) {
      const others = Object.entries(dto).filter(
        ([key, value]) => key !== "creditLimit" && value !== undefined,
      );
      if (others.length > 0) {
        throw new ForbiddenException(FINANCE_ADMIN_ONLY_CREDIT_LIMIT_MESSAGE);
      }
    }

    const existing = await this.companyRepository.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.legalName !== undefined) data.legalName = dto.legalName.trim();
    if (dto.taxId !== undefined) data.taxId = dto.taxId.trim();
    if (dto.email !== undefined) {
      data.email = dto.email ? dto.email.trim() : dto.email;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone ? dto.phone.trim() : dto.phone;
    }
    if (dto.fiscalName !== undefined) {
      data.fiscalName = dto.fiscalName ? dto.fiscalName.trim() : dto.fiscalName;
    }
    if (dto.fiscalAddress !== undefined) {
      data.fiscalAddress = dto.fiscalAddress
        ? dto.fiscalAddress.trim()
        : dto.fiscalAddress;
    }
    if (dto.creditDays !== undefined) data.creditDays = dto.creditDays;
    if (dto.creditLimit !== undefined) {
      data.creditLimit =
        dto.creditLimit === null ? null : new Prisma.Decimal(dto.creditLimit);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.companyRepository.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictException(
            `Ya existe otra empresa con el mismo ${describeUniqueTarget(error)}`,
          );
        }
        if (error.code === "P2025") {
          throw new NotFoundException(`Company with id ${id} not found`);
        }
      }
      throw error;
    }
  }
}
