import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CompleteCompanyOnboardingUseCase } from "./complete-company-onboarding.use-case";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { CompanyEntity } from "../../../domain/entities/company.entity";

describe("CompleteCompanyOnboardingUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";

  const findUnique = jest.fn();
  const update = jest.fn();
  const exists = jest.fn();

  const companyRepository = {
    findUnique,
    update,
  } as unknown as ICompanyRepository;
  const addressRepository = { exists } as unknown as ICompanyAddressRepository;

  let useCase: CompleteCompanyOnboardingUseCase;

  function company(overrides: Partial<CompanyEntity> = {}): CompanyEntity {
    const entity = new CompanyEntity();
    Object.assign(entity, {
      id: companyId,
      legalName: "Acme C.A.",
      taxId: "J-12345678-9",
      email: null,
      phone: null,
      fiscalName: null,
      fiscalAddress: "Av. Principal, Caracas",
      creditDays: 0,
      isActive: true,
      onboardingCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return entity;
  }

  function p2025(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("No record", {
      code: "P2025",
      clientVersion: "6",
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    exists.mockResolvedValue(true);
    update.mockImplementation(
      (args: { data: { onboardingCompletedAt: Date } }) =>
        Promise.resolve(
          company({ onboardingCompletedAt: args.data.onboardingCompletedAt }),
        ),
    );
    useCase = new CompleteCompanyOnboardingUseCase(
      companyRepository,
      addressRepository,
    );
  });

  it("lanza 404 si la empresa no existe", async () => {
    findUnique.mockResolvedValue(null);
    await expect(useCase.execute(companyId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("marca el onboarding si hay dirección fiscal y al menos una sede", async () => {
    findUnique.mockResolvedValue(company());
    const result = await useCase.execute(companyId);
    expect(result).toBeInstanceOf(Date);
    expect(exists).toHaveBeenCalledWith({ where: { companyId } });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: companyId,
        onboardingCompletedAt: null,
        addresses: { some: {} },
      },
      data: { onboardingCompletedAt: result },
    });
  });

  it("es idempotente: si ya estaba completado devuelve la fecha existente sin escribir", async () => {
    const previa = new Date("2026-10-01T12:00:00.000Z");
    findUnique.mockResolvedValue(company({ onboardingCompletedAt: previa }));
    await expect(useCase.execute(companyId)).resolves.toBe(previa);
    expect(update).not.toHaveBeenCalled();
    expect(exists).not.toHaveBeenCalled();
  });

  it("lanza 403 si la empresa está desactivada, sin escribir", async () => {
    findUnique.mockResolvedValue(company({ isActive: false }));
    await expect(useCase.execute(companyId)).rejects.toThrow(
      new ForbiddenException(
        "La empresa está desactivada y no puede operar. Contacta con Ofibites.",
      ),
    );
    expect(exists).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("lanza 400 si falta la dirección fiscal", async () => {
    findUnique.mockResolvedValue(company({ fiscalAddress: "   " }));
    await expect(useCase.execute(companyId)).rejects.toThrow(
      "Para completar el onboarding falta la dirección fiscal de la empresa.",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("lanza 400 si no hay ninguna sede", async () => {
    findUnique.mockResolvedValue(company());
    exists.mockResolvedValue(false);
    await expect(useCase.execute(companyId)).rejects.toThrow(
      "Para completar el onboarding falta al menos una sede.",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("lanza 400 con ambos faltantes en el mensaje", async () => {
    findUnique.mockResolvedValue(company({ fiscalAddress: null }));
    exists.mockResolvedValue(false);
    const error = await useCase.execute(companyId).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      "Para completar el onboarding falta la dirección fiscal de la empresa y al menos una sede.",
    );
  });

  it("si otra petición lo completó a la vez (P2025), devuelve la fecha ganadora", async () => {
    const ganadora = new Date("2026-11-03T15:00:00.000Z");
    findUnique
      .mockResolvedValueOnce(company())
      .mockResolvedValueOnce(company({ onboardingCompletedAt: ganadora }));
    update.mockRejectedValueOnce(p2025());
    await expect(useCase.execute(companyId)).resolves.toBe(ganadora);
  });

  it("si se borra la última sede entre la comprobación y el update (P2025), lanza 400 de sede", async () => {
    findUnique
      .mockResolvedValueOnce(company())
      .mockResolvedValueOnce(company());
    update.mockRejectedValueOnce(p2025());
    const error = await useCase.execute(companyId).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      "Para completar el onboarding falta al menos una sede.",
    );
  });

  it("si la empresa se borró entre la lectura y la escritura, lanza 404", async () => {
    findUnique.mockResolvedValueOnce(company()).mockResolvedValueOnce(null);
    update.mockRejectedValueOnce(p2025());
    await expect(useCase.execute(companyId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
