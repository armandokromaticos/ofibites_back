import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UpdateCompanyAddressUseCase } from "./update-company-address.use-case";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { CompanyAddressEntity } from "../../../domain/entities/company-address.entity";

describe("UpdateCompanyAddressUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const addressId = "22222222-2222-2222-2222-222222222222";

  const findUnique = jest.fn();
  const update = jest.fn();
  const setSingleBilling = jest.fn();
  const setSinglePrimary = jest.fn();

  const addressRepository = {
    findUnique,
    update,
    setSingleBilling,
    setSinglePrimary,
  } as unknown as ICompanyAddressRepository;

  let useCase: UpdateCompanyAddressUseCase;

  function existingAddress(overrides: Partial<CompanyAddressEntity> = {}) {
    const entity = new CompanyAddressEntity();
    Object.assign(entity, {
      id: addressId,
      companyId,
      label: "Sede Caracas",
      line1: "Av. Principal",
      line2: null,
      reference: null,
      city: "Caracas",
      state: null,
      country: "Venezuela",
      zip: null,
      contactName: "María Pérez",
      contactPhone: "+58 412-555-1234",
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
    findUnique.mockResolvedValue(existingAddress());
    update.mockResolvedValue(existingAddress());
    useCase = new UpdateCompanyAddressUseCase(addressRepository);
  });

  it("lanza 400 si el body está vacío", async () => {
    await expect(
      useCase.execute(companyId, addressId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("lanza 404 si la dirección no existe o es de otra empresa", async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      useCase.execute(companyId, addressId, { label: "Otra" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    findUnique.mockResolvedValue(
      existingAddress({ companyId: "otra-empresa" }),
    );
    await expect(
      useCase.execute(companyId, addressId, { label: "Otra" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("actualiza contactName/contactPhone recortados", async () => {
    update.mockResolvedValue(
      existingAddress({ contactName: "Juan Gómez", contactPhone: "0212-555" }),
    );

    await useCase.execute(companyId, addressId, {
      contactName: "  Juan Gómez  ",
      contactPhone: "  0212-555  ",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: addressId },
      data: { contactName: "Juan Gómez", contactPhone: "0212-555" },
    });
  });

  it("isPrimary=true actualiza y desmarca cualquier otra dirección primaria de la empresa", async () => {
    update.mockResolvedValue(existingAddress({ isPrimary: true }));
    findUnique
      .mockResolvedValueOnce(existingAddress()) // chequeo de existencia
      .mockResolvedValueOnce(existingAddress({ isPrimary: true })); // refresh post-setSinglePrimary

    const result = await useCase.execute(companyId, addressId, {
      isPrimary: true,
    });

    expect(setSinglePrimary).toHaveBeenCalledWith(companyId, addressId);
    expect(result.isPrimary).toBe(true);
  });

  it("isPrimary=false solo desmarca esa dirección, sin llamar a setSinglePrimary", async () => {
    update.mockResolvedValue(existingAddress({ isPrimary: false }));

    await useCase.execute(companyId, addressId, { isPrimary: false });

    expect(update).toHaveBeenCalledWith({
      where: { id: addressId },
      data: { isPrimary: false },
    });
    expect(setSinglePrimary).not.toHaveBeenCalled();
  });

  it("isBilling=true e isPrimary=true en el mismo PATCH aplican los dos invariantes", async () => {
    update.mockResolvedValue(
      existingAddress({ isBilling: true, isPrimary: true }),
    );
    findUnique
      .mockResolvedValueOnce(existingAddress())
      .mockResolvedValueOnce(
        existingAddress({ isBilling: true, isPrimary: true }),
      );

    const result = await useCase.execute(companyId, addressId, {
      isBilling: true,
      isPrimary: true,
    });

    expect(setSingleBilling).toHaveBeenCalledWith(companyId, addressId);
    expect(setSinglePrimary).toHaveBeenCalledWith(companyId, addressId);
    expect(result.isBilling).toBe(true);
    expect(result.isPrimary).toBe(true);
  });
});
