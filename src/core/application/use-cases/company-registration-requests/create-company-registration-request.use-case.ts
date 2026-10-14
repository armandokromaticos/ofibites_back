import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { ICompanyRegistrationRequestRepository } from "../../../domain/repositories/company-registration-request.repository.interface";
import { COMPANY_REGISTRATION_REQUEST_REPOSITORY } from "../../../domain/repositories/company-registration-request.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { CreateCompanyRegistrationRequestDto } from "../../dto/company-registration-requests/create-company-registration-request.dto";
import { CompanyRegistrationRequestEntity } from "../../../domain/entities/company-registration-request.entity";
import { RegistrationRequestStatus } from "../../../domain/enums/registration-request-status.enum";

@Injectable()
export class CreateCompanyRegistrationRequestUseCase {
  constructor(
    @Inject(COMPANY_REGISTRATION_REQUEST_REPOSITORY)
    private readonly requestRepository: ICompanyRegistrationRequestRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(
    dto: CreateCompanyRegistrationRequestDto,
  ): Promise<CompanyRegistrationRequestEntity> {
    const taxId = dto.taxId.trim();
    const contactEmail = dto.contactEmail.trim().toLowerCase();

    const companyWithTaxId = await this.companyRepository.findUnique({
      where: { taxId },
    });
    if (companyWithTaxId) {
      throw new ConflictException(
        `Ya existe una empresa registrada con el RIF ${taxId}.`,
      );
    }

    const approvedDuplicate = await this.requestRepository.exists({
      where: {
        status: RegistrationRequestStatus.APPROVED,
        OR: [{ taxId }, { contactEmail }],
      },
    });
    if (approvedDuplicate) {
      throw new ConflictException(
        "Ya existe una solicitud aprobada con el mismo RIF o email de contacto.",
      );
    }

    const entity = CompanyRegistrationRequestEntity.fromCreateParams({
      legalName: dto.legalName,
      taxId,
      contactName: dto.contactName,
      contactEmail,
      contactPhone: dto.contactPhone,
      position: dto.position ?? null,
      employeeCount: dto.employeeCount ?? null,
      generalNeed: dto.generalNeed,
      interestedSolutions: dto.interestedSolutions,
      orderFrequency: dto.orderFrequency,
      peoplePerOrder: dto.peoplePerOrder,
      additionalComments: dto.additionalComments ?? null,
    });

    return this.requestRepository.create(entity);
  }
}
