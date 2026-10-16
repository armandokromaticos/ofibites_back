import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { Role } from "../../../domain/enums/role.enum";
import { assertCanReadOrder } from "../../shared/order-read-access";

@Injectable()
export class GetOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  async execute(
    orderId: string,
    userId: string,
    userRole: Role,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    await assertCanReadOrder(order, userId, userRole, {
      companyMemberRepository: this.companyMemberRepository,
    });
    return order;
  }
}
