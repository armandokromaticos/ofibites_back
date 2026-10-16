import { ForbiddenException } from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";
import { OrderEntity } from "../../domain/entities/order.entity";
import { Role } from "../../domain/enums/role.enum";
import { PLATFORM_ORDER_READ_ROLES } from "./platform-roles.constants";

/**
 * Regla de lectura de `GET /orders/:id`: roles de plataforma con lectura de
 * órdenes, el dueño del pedido o un miembro activo de su empresa. 403 si no.
 */
export async function assertCanReadOrder(
  order: Pick<OrderEntity, "userId" | "companyId">,
  userId: string,
  userRole: Role,
  deps: { companyMemberRepository: ICompanyMemberRepository },
): Promise<void> {
  if (PLATFORM_ORDER_READ_ROLES.has(userRole)) {
    return;
  }
  if (order.userId === userId) {
    return;
  }
  if (order.companyId) {
    const member =
      await deps.companyMemberRepository.findActiveByUserAndCompany(
        userId,
        order.companyId,
      );
    if (member) {
      return;
    }
  }
  throw new ForbiddenException("No tienes acceso a esta orden");
}
