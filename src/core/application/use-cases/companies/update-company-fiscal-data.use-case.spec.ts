import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCompanyFiscalDataUseCase } from "./update-company-fiscal-data.use-case";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { CompanyEntity } from "../../../domain/entities/company.entity";
import { UpdateCompanyFiscalDataDto } from "../../dto/companies/update-company-fiscal-data.dto";

describe("UpdateCompanyFiscalDataUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const update = jest.fn();
  const companyRepository = { update } as unknown as ICompanyRepository;
  let useCase: UpdateCompanyFiscalDataUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue(new CompanyEntity());
    useCase = new UpdateCompanyFiscalDataUseCase(companyRepository);
  });

  it("actualiza solo la dirección fiscal si no llega fiscalName", async () => {
    await useCase.execute(companyId, { fiscalAddress: "  Av. Principal  " });
    expect(update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { fiscalAddress: "Av. Principal" },
    });
  });

  it("actualiza el nombre fiscal y lo borra con null", async () => {
    await useCase.execute(companyId, {
      fiscalAddress: "Av. Principal",
      fiscalName: " Acme C.A. ",
    });
    expect(update).toHaveBeenLastCalledWith({
      where: { id: companyId },
      data: { fiscalAddress: "Av. Principal", fiscalName: "Acme C.A." },
    });

    await useCase.execute(companyId, {
      fiscalAddress: "Av. Principal",
      fiscalName: null,
    });
    expect(update).toHaveBeenLastCalledWith({
      where: { id: companyId },
      data: { fiscalAddress: "Av. Principal", fiscalName: null },
    });
  });

  it("nunca toca la razón social ni el RIF", async () => {
    await useCase.execute(companyId, {
      fiscalAddress: "Av. Principal",
      legalName: "Otra",
      taxId: "J-0",
    } as unknown as UpdateCompanyFiscalDataDto);
    const [[{ data }]] = update.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(data).not.toHaveProperty("legalName");
    expect(data).not.toHaveProperty("taxId");
  });

  it("lanza 404 si la empresa no existe (P2025)", async () => {
    update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("No record", {
        code: "P2025",
        clientVersion: "6",
      }),
    );
    await expect(
      useCase.execute(companyId, { fiscalAddress: "Av. Principal" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("DTO", () => {
    async function validar(body: Record<string, unknown>) {
      const dto = plainToInstance(UpdateCompanyFiscalDataDto, body);
      return { dto, errors: await validate(dto) };
    }

    it("rechaza una dirección fiscal vacía, solo con espacios o ausente", async () => {
      expect((await validar({ fiscalAddress: "   " })).errors).toHaveLength(1);
      expect((await validar({})).errors).toHaveLength(1);
    });

    it("rechaza una dirección fiscal de más de 500 caracteres", async () => {
      const { errors } = await validar({ fiscalAddress: "a".repeat(501) });
      expect(errors).toHaveLength(1);
    });

    it("recorta espacios y convierte fiscalName vacío en null", async () => {
      const { dto, errors } = await validar({
        fiscalAddress: "  Av. Principal ",
        fiscalName: "  ",
      });
      expect(errors).toHaveLength(0);
      expect(dto.fiscalAddress).toBe("Av. Principal");
      expect(dto.fiscalName).toBeNull();
    });

    it("rechaza un fiscalName de más de 200 caracteres", async () => {
      const { errors } = await validar({
        fiscalAddress: "Av. Principal",
        fiscalName: "a".repeat(201),
      });
      expect(errors).toHaveLength(1);
    });
  });
});
