import { NotFoundException } from "@nestjs/common";
import { CreateCompanyAddressUseCase } from "./create-company-address.use-case";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { CompanyAddressEntity } from "../../../domain/entities/company-address.entity";
import { CreateCompanyAddressDto } from "../../dto/company-addresses/create-company-address.dto";

describe("CreateCompanyAddressUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";

  const findUniqueCompany = jest.fn();
  const create = jest.fn();
  const setSingleBilling = jest.fn();
  const createAndSetSingleBilling = jest.fn();
  const setSinglePrimary = jest.fn();
  const createAndSetSinglePrimary = jest.fn();
  const findUnique = jest.fn();

  const companyRepository = {
    findUnique: findUniqueCompany,
  } as unknown as ICompanyRepository;

  const addressRepository = {
    create,
    findUnique,
    setSingleBilling,
    createAndSetSingleBilling,
    setSinglePrimary,
    createAndSetSinglePrimary,
  } as unknown as ICompanyAddressRepository;

  let useCase: CreateCompanyAddressUseCase;

  const baseDto: CreateCompanyAddressDto = {
    label: "Sede Caracas",
    line1: "Av. Principal",
    city: "Caracas",
    country: "Venezuela",
    contactName: "María Pérez",
    contactPhone: "+58 412-555-1234",
  };

  function addressRow(overrides: Partial<CompanyAddressEntity> = {}) {
    const entity = new CompanyAddressEntity();
    Object.assign(entity, {
      id: "addr-1",
      companyId,
      label: baseDto.label,
      line1: baseDto.line1,
      line2: null,
      reference: null,
      city: baseDto.city,
      state: null,
      country: baseDto.country,
      zip: null,
      contactName: baseDto.contactName,
      contactPhone: baseDto.contactPhone,
      isBilling: false,
      isShipping: true,
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return entity;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueCompany.mockResolvedValue({ id: companyId });
    useCase = new CreateCompanyAddressUseCase(
      addressRepository,
      companyRepository,
    );
  });

  it("lanza 404 si la empresa no existe", async () => {
    findUniqueCompany.mockResolvedValue(null);

    await expect(useCase.execute(companyId, baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("crea sin isBilling ni isPrimary con el create simple", async () => {
    create.mockResolvedValue(addressRow());

    const result = await useCase.execute(companyId, baseDto);

    expect(create).toHaveBeenCalledTimes(1);
    expect(createAndSetSingleBilling).not.toHaveBeenCalled();
    expect(createAndSetSinglePrimary).not.toHaveBeenCalled();
    expect(result.contactName).toBe("María Pérez");
    expect(result.contactPhone).toBe("+58 412-555-1234");
    expect(result.isPrimary).toBe(false);
  });

  it("isPrimary=true crea y desmarca cualquier otra dirección primaria de la empresa", async () => {
    createAndSetSinglePrimary.mockResolvedValue(
      addressRow({ isPrimary: true }),
    );

    const result = await useCase.execute(companyId, {
      ...baseDto,
      isPrimary: true,
    });

    expect(createAndSetSinglePrimary).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(result.isPrimary).toBe(true);
  });

  it("isBilling=true usa createAndSetSingleBilling (invariante existente, sin romper)", async () => {
    createAndSetSingleBilling.mockResolvedValue(
      addressRow({ isBilling: true }),
    );

    await useCase.execute(companyId, { ...baseDto, isBilling: true });

    expect(createAndSetSingleBilling).toHaveBeenCalledTimes(1);
    expect(createAndSetSinglePrimary).not.toHaveBeenCalled();
  });

  it("isBilling=true e isPrimary=true crean y aplican los dos invariantes sobre la misma fila", async () => {
    const created = addressRow({ isBilling: true, isPrimary: true });
    create.mockResolvedValue(created);
    findUnique.mockResolvedValue(created);

    const result = await useCase.execute(companyId, {
      ...baseDto,
      isBilling: true,
      isPrimary: true,
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(setSingleBilling).toHaveBeenCalledWith(companyId, created.id);
    expect(setSinglePrimary).toHaveBeenCalledWith(companyId, created.id);
    expect(result.isBilling).toBe(true);
    expect(result.isPrimary).toBe(true);
  });
});
