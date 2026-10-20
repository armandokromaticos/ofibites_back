import { GetOrdersUseCase } from "./get-orders.use-case";
import { Role } from "../../../domain/enums/role.enum";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { OrderStatusGroup } from "../../../domain/services/order-status-groups";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import type { OrderVisibilityResolver } from "../../services/order-visibility.resolver";
import { GetOrdersQueryDto } from "../../dto/orders/get-orders-query.dto";

function setup() {
  const orderRepository = {
    findVisible: jest.fn(() => Promise.resolve({ data: [] })),
  };
  const visibilityResolver = {
    resolve: jest.fn(() => Promise.resolve({ type: "all" })),
  };
  const useCase = new GetOrdersUseCase(
    orderRepository as unknown as IOrderRepository,
    visibilityResolver as unknown as OrderVisibilityResolver,
  );
  return { useCase, orderRepository, visibilityResolver };
}

describe("GetOrdersUseCase", () => {
  it("sin query: pide solo la visibilidad, sin filtros ni paginación", async () => {
    const { useCase, orderRepository } = setup();

    await useCase.execute("user-1", Role.CLIENT, undefined);

    expect(orderRepository.findVisible).toHaveBeenCalledWith({
      visibility: { type: "all" },
      statuses: undefined,
      userId: undefined,
      branchId: undefined,
      departmentId: undefined,
      deliveryDateFrom: undefined,
      deliveryDateTo: undefined,
      search: undefined,
      skip: undefined,
      take: undefined,
    });
  });

  it("statusGroup se traduce a la lista de OrderStatus del grupo", async () => {
    const { useCase, orderRepository } = setup();

    await useCase.execute("user-1", Role.CLIENT, undefined, {
      statusGroup: OrderStatusGroup.SCHEDULED,
    } as GetOrdersQueryDto);

    expect(orderRepository.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION],
      }),
    );
  });

  it("deliveryDateFrom/To se convierten a medianoche UTC de esa fecha", async () => {
    const { useCase, orderRepository } = setup();

    await useCase.execute("user-1", Role.CLIENT, undefined, {
      deliveryDateFrom: "2026-10-01",
      deliveryDateTo: "2026-10-31",
    } as GetOrdersQueryDto);

    expect(orderRepository.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryDateFrom: new Date("2026-10-01T00:00:00.000Z"),
        deliveryDateTo: new Date("2026-10-31T00:00:00.000Z"),
      }),
    );
  });

  it("pasa branchId, departmentId, userId, search, skip y take tal cual", async () => {
    const { useCase, orderRepository } = setup();

    await useCase.execute("user-1", Role.CLIENT, undefined, {
      branchId: "branch-1",
      departmentId: "dept-1",
      userId: "owner-1",
      search: "OF-2026-0007",
      skip: 10,
      take: 20,
    } as GetOrdersQueryDto);

    expect(orderRepository.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-1",
        departmentId: "dept-1",
        userId: "owner-1",
        search: "OF-2026-0007",
        skip: 10,
        take: 20,
      }),
    );
  });

  it("devuelve tal cual lo que responde el repositorio ({ data, total } o { data })", async () => {
    const { useCase, orderRepository } = setup();
    orderRepository.findVisible.mockResolvedValueOnce({ data: [], total: 7 });

    const result = await useCase.execute("user-1", Role.CLIENT, undefined, {
      skip: 0,
      take: 20,
    } as GetOrdersQueryDto);

    expect(result).toEqual({ data: [], total: 7 });
  });
});
