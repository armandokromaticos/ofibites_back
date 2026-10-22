import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_ADDRESS_REPOSITORY } from "../../../domain/repositories/company-address.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { CreateCompanyAddressDto } from "../../dto/company-addresses/create-company-address.dto";
import { CompanyAddressEntity } from "../../../domain/entities/company-address.entity";

@Injectable()
export class CreateCompanyAddressUseCase {
  constructor(
    @Inject(COMPANY_ADDRESS_REPOSITORY)
    private readonly addressRepository: ICompanyAddressRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(
    companyId: string,
    dto: CreateCompanyAddressDto,
  ): Promise<CompanyAddressEntity> {
    const company = await this.companyRepository.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const entity = CompanyAddressEntity.fromCreateParams({
      companyId,
      label: dto.label,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      reference: dto.reference ?? null,
      city: dto.city,
      state: dto.state ?? null,
      country: dto.country,
      zip: dto.zip ?? null,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      isBilling: dto.isBilling,
      isShipping: dto.isShipping,
      isPrimary: dto.isPrimary,
    });

    // isBilling e isPrimary son invariantes independientes ("una sola
    // dirección de billing" / "una sola sede principal" por empresa). El
    // caso común (solo uno de los dos, o ninguno) usa el método combinado
    // atómico (create + desmarcar las demás en una transacción); si ambos
    // vienen en true se encadenan los dos pasos sobre la misma fila creada.
    if (entity.isBilling && entity.isPrimary) {
      const created = await this.addressRepository.create(entity);
      await this.addressRepository.setSingleBilling(companyId, created.id);
      await this.addressRepository.setSinglePrimary(companyId, created.id);
      const refreshed = await this.addressRepository.findUnique({
        where: { id: created.id },
      });
      return refreshed ?? created;
    }

    if (entity.isBilling) {
      return this.addressRepository.createAndSetSingleBilling(entity);
    }

    if (entity.isPrimary) {
      return this.addressRepository.createAndSetSinglePrimary(entity);
    }

    return this.addressRepository.create(entity);
  }
}
