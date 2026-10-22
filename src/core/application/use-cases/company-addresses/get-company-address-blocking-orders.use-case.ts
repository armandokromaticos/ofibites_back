import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_ADDRESS_REPOSITORY } from "../../../domain/repositories/company-address.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import { Role } from "../../../domain/enums/role.enum";
import { assertCompanyAccess } from "../../shared/company-access.guard";
import { ORDER_IN_PROGRESS_STATUSES } from "../../../domain/services/order-status-groups";
import { toOrderNumber } from "../../../domain/entities/notification.entity";
import { CompanyAddressBlockingOrderDto } from "../../dto/company-addresses/company-address-blocking-order.dto";

/**
 * T-31a: pedidos en curso (no terminales) que usan esta dirección como
 * entrega. Solo lectura, para que el front avise antes de intentar borrar
 * (Figma 3659:2271). No reemplaza el gate real del `DELETE` (409 por FK).
 */
@Injectable()
export class GetCompanyAddressBlockingOrdersUseCase {
  constructor(
    @Inject(COMPANY_ADDRESS_REPOSITORY)
    private readonly addressRepository: ICompanyAddressRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(
    companyId: string,
    id: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<CompanyAddressBlockingOrderDto[]> {
    await assertCompanyAccess(callerUserId, callerRole, companyId, {
      companyMemberRepository: this.companyMemberRepository,
    });

    const address = await this.addressRepository.findUnique({
      where: { id },
    });
    if (!address || address.companyId !== companyId) {
      throw new NotFoundException(
        `Address ${id} not found in company ${companyId}`,
      );
    }

    const { data: orders } = await this.orderRepository.findMany({
      where: {
        deliveryAddressId: id,
        status: { in: [...ORDER_IN_PROGRESS_STATUSES] },
      },
      orderBy: { deliveryDate: "asc" },
    });

    return orders.map((order) => {
      const dto = new CompanyAddressBlockingOrderDto();
      dto.orderNumber = order.orderNumber ?? toOrderNumber(order.id ?? "");
      dto.deliveryDate = order.deliveryDate
        ? order.deliveryDate.toISOString()
        : null;
      return dto;
    });
  }
}
