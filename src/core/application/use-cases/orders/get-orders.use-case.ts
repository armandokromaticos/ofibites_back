import { Inject, Injectable } from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { Role } from "../../../domain/enums/role.enum";
import { ORDER_STATUSES_BY_GROUP } from "../../../domain/services/order-status-groups";
import { OrderVisibilityResolver } from "../../services/order-visibility.resolver";
import { GetOrdersQueryDto } from "../../dto/orders/get-orders-query.dto";

/** "YYYY-MM-DD" → medianoche UTC de esa fecha (igual a como se persiste `deliveryDate`). */
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export interface GetOrdersResult {
  data: OrderEntity[];
  total?: number;
}

@Injectable()
export class GetOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    private readonly visibilityResolver: OrderVisibilityResolver,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    companyIdFilter?: string,
    query?: GetOrdersQueryDto,
  ): Promise<GetOrdersResult> {
    const visibility = await this.visibilityResolver.resolve(
      userId,
      userRole,
      companyIdFilter,
    );

    return this.orderRepository.findVisible({
      visibility,
      statuses: query?.statusGroup
        ? ORDER_STATUSES_BY_GROUP[query.statusGroup]
        : undefined,
      userId: query?.userId,
      branchId: query?.branchId,
      departmentId: query?.departmentId,
      deliveryDateFrom: query?.deliveryDateFrom
        ? parseDateOnly(query.deliveryDateFrom)
        : undefined,
      deliveryDateTo: query?.deliveryDateTo
        ? parseDateOnly(query.deliveryDateTo)
        : undefined,
      search: query?.search,
      skip: query?.skip,
      take: query?.take,
    });
  }
}
