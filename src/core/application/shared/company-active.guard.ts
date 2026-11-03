import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ICompanyRepository } from "../../domain/repositories/company.repository.interface";

export const COMPANY_INACTIVE_MESSAGE =
  "La empresa está desactivada y no puede operar. Contacta con Ofibites.";

export interface CompanyActiveDeps {
  companyRepository: ICompanyRepository;
}

/**
 * Asegura que la empresa existe y está activa. Una empresa con isActive=false
 * no puede operar (crear pedidos, construir carrito). 404 si no existe, 403 si
 * está desactivada.
 */
export async function assertCompanyActive(
  companyId: string,
  deps: CompanyActiveDeps,
): Promise<void> {
  const company = await deps.companyRepository.findUnique({
    where: { id: companyId },
  });
  if (!company) {
    throw new NotFoundException(`Company with id ${companyId} not found`);
  }
  if (!company.isActive) {
    throw new ForbiddenException(COMPANY_INACTIVE_MESSAGE);
  }
}
