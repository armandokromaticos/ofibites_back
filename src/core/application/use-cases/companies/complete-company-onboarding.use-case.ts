import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_ADDRESS_REPOSITORY } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_INACTIVE_MESSAGE } from "../../shared/company-active.guard";

const MISSING_PREFIX = "Para completar el onboarding falta";

/**
 * T-34a: cierra el onboarding del cliente. Requisitos: dirección fiscal no
 * vacía y al menos una sede (`CompanyAddress`); invitar al equipo es opcional.
 * Idempotente: si ya estaba completado devuelve la fecha existente.
 */
@Injectable()
export class CompleteCompanyOnboardingUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(COMPANY_ADDRESS_REPOSITORY)
    private readonly addressRepository: ICompanyAddressRepository,
  ) {}

  async execute(companyId: string): Promise<Date> {
    const company = await this.companyRepository.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException("Empresa no encontrada");
    }
    if (!company.isActive) {
      throw new ForbiddenException(COMPANY_INACTIVE_MESSAGE);
    }
    if (company.onboardingCompletedAt) {
      return company.onboardingCompletedAt;
    }

    const hasAddress = await this.addressRepository.exists({
      where: { companyId },
    });
    const missing = company.getOnboardingMissingRequirements(
      hasAddress ? 1 : 0,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `${MISSING_PREFIX} ${missing.join(" y ")}.`,
      );
    }

    const now = new Date();
    try {
      // Solo se marca si sigue pendiente (dos peticiones simultáneas no pisan
      // la fecha de la primera) y si aún tiene al menos una sede (un borrado
      // de la última sede entre la comprobación y el update no se cuela).
      const updated = await this.companyRepository.update({
        where: {
          id: companyId,
          onboardingCompletedAt: null,
          addresses: { some: {} },
        },
        data: { onboardingCompletedAt: now },
      });
      return updated.onboardingCompletedAt ?? now;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        const current = await this.companyRepository.findUnique({
          where: { id: companyId },
        });
        if (!current) {
          throw new NotFoundException("Empresa no encontrada");
        }
        if (current.onboardingCompletedAt) {
          return current.onboardingCompletedAt;
        }
        // Sigue pendiente: el update falló porque ya no quedaba ninguna sede.
        throw new BadRequestException(
          `${MISSING_PREFIX} ${current.getOnboardingMissingRequirements(0).join(" y ")}.`,
        );
      }
      throw error;
    }
  }
}
