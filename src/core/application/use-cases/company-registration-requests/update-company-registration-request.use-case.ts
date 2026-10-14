import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyRegistrationRequestRepository } from "../../../domain/repositories/company-registration-request.repository.interface";
import { COMPANY_REGISTRATION_REQUEST_REPOSITORY } from "../../../domain/repositories/company-registration-request.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { UpdateCompanyRegistrationRequestDto } from "../../dto/company-registration-requests/update-company-registration-request.dto";
import { CompanyRegistrationRequestEntity } from "../../../domain/entities/company-registration-request.entity";
import { RegistrationRequestStatus } from "../../../domain/enums/registration-request-status.enum";

@Injectable()
export class UpdateCompanyRegistrationRequestUseCase {
  constructor(
    @Inject(COMPANY_REGISTRATION_REQUEST_REPOSITORY)
    private readonly requestRepository: ICompanyRegistrationRequestRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateCompanyRegistrationRequestDto,
  ): Promise<CompanyRegistrationRequestEntity> {
    const current = await this.requestRepository.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Solicitud ${id} no encontrada.`);
    }

    if (current.status !== RegistrationRequestStatus.PENDING) {
      throw new BadRequestException(
        `Solo se pueden editar solicitudes en estado PENDING (actual: ${current.status}).`,
      );
    }

    const data: Prisma.CompanyRegistrationRequestUpdateManyMutationInput = {};

    if (dto.legalName !== undefined) {
      data.legalName = dto.legalName.trim();
    }

    let nextTaxId = current.taxId;
    if (dto.taxId !== undefined) {
      nextTaxId = dto.taxId.trim();
      if (nextTaxId !== current.taxId) {
        // Best-effort: detecta conflicto con una Company ya existente. La constraint
        // unique de Company.taxId enforza la garantía final al momento del approve.
        const companyWithTaxId = await this.companyRepository.findUnique({
          where: { taxId: nextTaxId },
        });
        if (companyWithTaxId) {
          throw new ConflictException(
            `Ya existe una empresa registrada con el RIF ${nextTaxId}.`,
          );
        }
      }
      data.taxId = nextTaxId;
    }

    if (dto.contactName !== undefined) {
      data.contactName = dto.contactName.trim();
    }

    let nextContactEmail = current.contactEmail;
    if (dto.contactEmail !== undefined) {
      nextContactEmail = dto.contactEmail.trim().toLowerCase();
      data.contactEmail = nextContactEmail;
    }

    if (dto.contactPhone !== undefined) {
      data.contactPhone = dto.contactPhone.trim();
    }

    if (dto.position !== undefined) {
      data.position = dto.position?.trim() || null;
    }

    if (dto.employeeCount !== undefined) {
      data.employeeCount = dto.employeeCount;
    }

    if (dto.generalNeed !== undefined) {
      data.generalNeed = dto.generalNeed.trim();
    }

    if (dto.interestedSolutions !== undefined) {
      data.interestedSolutions = { set: dto.interestedSolutions };
    }

    if (dto.orderFrequency !== undefined) {
      data.orderFrequency = dto.orderFrequency;
    }

    if (dto.peoplePerOrder !== undefined) {
      data.peoplePerOrder = dto.peoplePerOrder;
    }

    if (dto.additionalComments !== undefined) {
      data.additionalComments = dto.additionalComments?.trim() || null;
    }

    const taxIdChanged = nextTaxId !== current.taxId;
    const emailChanged = nextContactEmail !== current.contactEmail;
    if (taxIdChanged || emailChanged) {
      // Best-effort: el check contra APPROVED no puede ser exacto sin un índice
      // único parcial (Prisma no lo expone declarativamente y el diseño permite
      // PENDING/REJECTED duplicados). Race con un APPROVED concurrente es benigna:
      // el approve posterior fallará por Company.taxId unique.
      const approvedDuplicate = await this.requestRepository.exists({
        where: {
          id: { not: id },
          status: RegistrationRequestStatus.APPROVED,
          OR: [{ taxId: nextTaxId }, { contactEmail: nextContactEmail }],
        },
      });
      if (approvedDuplicate) {
        throw new ConflictException(
          "Ya existe una solicitud aprobada con el mismo RIF o email de contacto.",
        );
      }
    }

    const updated = await this.requestRepository.updateIfPending(id, data);
    if (!updated) {
      const existing = await this.requestRepository.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`Solicitud ${id} no encontrada.`);
      }
      throw new BadRequestException(
        `Solo se pueden editar solicitudes en estado PENDING (actual: ${existing.status}).`,
      );
    }

    return updated;
  }
}
