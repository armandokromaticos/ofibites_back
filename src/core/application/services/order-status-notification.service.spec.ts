import { BadRequestException, Logger } from "@nestjs/common";
import {
  buildOrderStatusMessage,
  formatDeliveryDate,
  formatDeliveryTime,
  OrderStatusNotificationService,
} from "./order-status-notification.service";
import { UpdateOrderStatusUseCase } from "../use-cases/orders/update-order-status.use-case";
import { CancelOrderUseCase } from "../use-cases/orders/cancel-order.use-case";
import type { INotificationRepository } from "../../domain/repositories/notification.repository.interface";
import type { IOrderRepository } from "../../domain/repositories/order.repository.interface";
import { NotificationEntity } from "../../domain/entities/notification.entity";
import { OrderEntity } from "../../domain/entities/order.entity";
import { OrderStatus } from "../../domain/enums/order-status.enum";
import { OrderPriority } from "../../domain/enums/order-priority.enum";
import { Role } from "../../domain/enums/role.enum";

const ORDER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function order(
  status: OrderStatus,
  overrides: {
    userId?: string | null;
    deliveryTime?: string | null;
    deliveryDate?: Date | null;
    orderNumber?: string | null;
  } = {},
): OrderEntity {
  return new OrderEntity({
    id: ORDER_ID,
    userId: overrides.userId === undefined ? "user-1" : overrides.userId,
    couponId: null,
    companyId: "company-1",
    branchId: null,
    departmentId: null,
    createdById: "user-1",
    deliveryAddressId: "address-1",
    deliveryDate:
      overrides.deliveryDate === undefined
        ? new Date("2026-09-04T00:00:00.000Z")
        : overrides.deliveryDate,
    deliveryTime:
      overrides.deliveryTime === undefined ? "10:30" : overrides.deliveryTime,
    notes: null,
    priority: OrderPriority.MEDIUM,
    status,
    subtotal: 10,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 10,
    // Por defecto sin número (pedido anterior al backfill): usa el respaldo.
    orderNumber: overrides.orderNumber ?? null,
    receiverName: null,
    receiverPhone: null,
    addressDetail: null,
    addressReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  });
}

function notificationRepo(fail = false) {
  return {
    create: jest.fn((n: NotificationEntity) =>
      fail ? Promise.reject(new Error("BD caída")) : Promise.resolve(n),
    ),
  };
}

let loggerError: jest.SpyInstance;

beforeEach(() => {
  loggerError = jest
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("mensajes de cambio de estado", () => {
  it("formatea la hora de entrega en 12 h (hora de pared de Caracas)", () => {
    expect(formatDeliveryTime("10:30")).toBe("10:30 am");
    expect(formatDeliveryTime("00:05")).toBe("12:05 am");
    expect(formatDeliveryTime("12:00")).toBe("12:00 pm");
    expect(formatDeliveryTime("18:45")).toBe("6:45 pm");
    expect(formatDeliveryTime("25:00")).toBeNull();
    expect(formatDeliveryTime(null)).toBeNull();
  });

  it("lee la fecha @db.Date en UTC para no correr el día", () => {
    expect(formatDeliveryDate(new Date("2026-09-04T00:00:00.000Z"))).toBe(
      "4 de sep",
    );
  });

  it.each([
    [
      OrderStatus.IN_TRANSIT,
      "Tu pedido #7728950E va en camino. Llega a las 10:30 am.",
    ],
    [OrderStatus.DELIVERED, "Tu pedido #7728950E fue entregado."],
    [
      OrderStatus.CONFIRMED,
      "Tu pedido #7728950E fue confirmado para el 4 de sep a las 10:30 am.",
    ],
    [OrderStatus.CANCELLED, "Tu pedido #7728950E fue cancelado."],
    [OrderStatus.REJECTED, "Tu pedido #7728950E fue rechazado."],
    [OrderStatus.IN_PREPARATION, "Tu pedido #7728950E está en preparación."],
    [
      OrderStatus.PENDING_APPROVAL,
      "Tu pedido #7728950E está pendiente de aprobación.",
    ],
    [
      OrderStatus.PENDING_CONFIRMATION,
      "Tu pedido #7728950E está pendiente de confirmación por Ofibites.",
    ],
    [
      OrderStatus.IN_ADJUSTMENT,
      "Tu pedido #7728950E está en ajuste. Te avisaremos cuando esté listo para confirmar.",
    ],
  ])("%s → %s", (status, expected) => {
    expect(buildOrderStatusMessage(order(status), status)).toBe(expected);
  });

  it("sin hora de entrega omite la hora", () => {
    const o = order(OrderStatus.IN_TRANSIT, { deliveryTime: null });
    expect(buildOrderStatusMessage(o, OrderStatus.IN_TRANSIT)).toBe(
      "Tu pedido #7728950E va en camino.",
    );
  });

  it("CONFIRMED con fecha y sin hora", () => {
    const o = order(OrderStatus.CONFIRMED, { deliveryTime: null });
    expect(buildOrderStatusMessage(o, OrderStatus.CONFIRMED)).toBe(
      "Tu pedido #7728950E fue confirmado para el 4 de sep.",
    );
  });

  it("CONFIRMED sin fecha ni hora", () => {
    const o = order(OrderStatus.CONFIRMED, {
      deliveryTime: null,
      deliveryDate: null,
    });
    expect(buildOrderStatusMessage(o, OrderStatus.CONFIRMED)).toBe(
      "Tu pedido #7728950E fue confirmado.",
    );
  });

  it("CREATED no se notifica", () => {
    expect(
      buildOrderStatusMessage(order(OrderStatus.CREATED), OrderStatus.CREATED),
    ).toBeNull();
  });
});

describe("número del pedido en la notificación (T-26a)", () => {
  it("usa el orderNumber real OF-AAAA-NNNN cuando existe", () => {
    const o = order(OrderStatus.IN_TRANSIT, { orderNumber: "OF-2026-0042" });
    expect(buildOrderStatusMessage(o, OrderStatus.IN_TRANSIT)).toBe(
      "Tu pedido #OF-2026-0042 va en camino. Llega a las 10:30 am.",
    );
  });

  it("sin orderNumber (pedido anterior al backfill) cae a los últimos 8 del id", () => {
    const o = order(OrderStatus.DELIVERED, { orderNumber: null });
    expect(buildOrderStatusMessage(o, OrderStatus.DELIVERED)).toBe(
      "Tu pedido #7728950E fue entregado.",
    );
  });

  it("la respuesta expone el orderNumber del pedido cargado, o el respaldo", () => {
    const row = {
      id: "n-1",
      userId: "user-1",
      companyId: "company-1",
      type: "ORDER_STATUS",
      message: "Tu pedido #OF-2026-0042 fue entregado.",
      link: `/pedidos/${ORDER_ID}`,
      orderId: ORDER_ID,
      orderStatus: "DELIVERED",
      readAt: null,
      createdAt: new Date("2026-10-16T12:00:00.000Z"),
    } as const;
    expect(
      NotificationEntity.fromPrisma({
        ...row,
        order: { orderNumber: "OF-2026-0042" },
      }).toResponseDto().orderNumber,
    ).toBe("OF-2026-0042");
    expect(
      NotificationEntity.fromPrisma({
        ...row,
        order: { orderNumber: null },
      }).toResponseDto().orderNumber,
    ).toBe("7728950E");
  });
});

describe("OrderStatusNotificationService", () => {
  it("crea la notificación para Order.userId con estado, empresa y link", async () => {
    const repo = notificationRepo();
    const service = new OrderStatusNotificationService(
      repo as unknown as INotificationRepository,
    );

    await service.notifyStatusChange(order(OrderStatus.IN_TRANSIT), "admin-1");

    expect(repo.create).toHaveBeenCalledTimes(1);
    const created = repo.create.mock.calls[0][0];
    expect(created.toPrismaCreate()).toEqual({
      userId: "user-1",
      companyId: "company-1",
      type: "ORDER_STATUS",
      message: "Tu pedido #7728950E va en camino. Llega a las 10:30 am.",
      link: `/pedidos/${ORDER_ID}`,
      orderId: ORDER_ID,
      orderStatus: OrderStatus.IN_TRANSIT,
    });
  });

  it("no notifica si el pedido no tiene usuario", async () => {
    const repo = notificationRepo();
    const service = new OrderStatusNotificationService(
      repo as unknown as INotificationRepository,
    );

    await service.notifyStatusChange(
      order(OrderStatus.DELIVERED, { userId: null }),
    );

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("no notifica al usuario de su propia acción", async () => {
    const repo = notificationRepo();
    const service = new OrderStatusNotificationService(
      repo as unknown as INotificationRepository,
    );

    await service.notifyStatusChange(order(OrderStatus.CANCELLED), "user-1");

    expect(repo.create).not.toHaveBeenCalled();
  });

  it("un fallo al guardar no lanza y queda registrado", async () => {
    const repo = notificationRepo(true);
    const service = new OrderStatusNotificationService(
      repo as unknown as INotificationRepository,
    );

    await expect(
      service.notifyStatusChange(order(OrderStatus.IN_TRANSIT)),
    ).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("No se pudo crear la notificación"),
      expect.any(String),
    );
  });
});

describe("generación al transicionar el pedido", () => {
  function orderRepo(from: OrderStatus, to: OrderStatus) {
    return {
      findUnique: jest.fn(() => Promise.resolve(order(from))),
      updateStatus: jest.fn(() => Promise.resolve(order(to))),
    };
  }

  it("UpdateOrderStatus notifica al dueño del pedido con el estado destino", async () => {
    const orders = orderRepo(
      OrderStatus.IN_PREPARATION,
      OrderStatus.IN_TRANSIT,
    );
    const notifications = notificationRepo();
    const useCase = new UpdateOrderStatusUseCase(
      orders as unknown as IOrderRepository,
      new OrderStatusNotificationService(
        notifications as unknown as INotificationRepository,
      ),
    );

    const result = await useCase.execute(
      ORDER_ID,
      OrderStatus.IN_TRANSIT,
      "admin-1",
    );

    expect(result.status).toBe(OrderStatus.IN_TRANSIT);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][0].orderStatus).toBe(
      OrderStatus.IN_TRANSIT,
    );
  });

  it("UpdateOrderStatus sin actorUserId también notifica al dueño", async () => {
    const orders = orderRepo(OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION);
    const notifications = notificationRepo();
    const useCase = new UpdateOrderStatusUseCase(
      orders as unknown as IOrderRepository,
      new OrderStatusNotificationService(
        notifications as unknown as INotificationRepository,
      ),
    );

    await useCase.execute(ORDER_ID, OrderStatus.IN_PREPARATION);

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][0].userId).toBe("user-1");
  });

  it("si falla la notificación, la transición se devuelve igual", async () => {
    const orders = orderRepo(OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED);
    const useCase = new UpdateOrderStatusUseCase(
      orders as unknown as IOrderRepository,
      new OrderStatusNotificationService(
        notificationRepo(true) as unknown as INotificationRepository,
      ),
    );

    const result = await useCase.execute(
      ORDER_ID,
      OrderStatus.DELIVERED,
      "admin-1",
    );

    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(orders.updateStatus).toHaveBeenCalledWith(
      ORDER_ID,
      OrderStatus.DELIVERED,
    );
  });

  it("una transición inválida no persiste ni notifica", async () => {
    const orders = orderRepo(OrderStatus.DELIVERED, OrderStatus.CANCELLED);
    const notifications = notificationRepo();
    const useCase = new UpdateOrderStatusUseCase(
      orders as unknown as IOrderRepository,
      new OrderStatusNotificationService(
        notifications as unknown as INotificationRepository,
      ),
    );

    await expect(
      useCase.execute(ORDER_ID, OrderStatus.CANCELLED, "admin-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("CancelOrder por un SUPER_ADMIN notifica al dueño; por el dueño no", async () => {
    const notifications = notificationRepo();
    const service = new OrderStatusNotificationService(
      notifications as unknown as INotificationRepository,
    );

    await new CancelOrderUseCase(
      orderRepo(
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ) as unknown as IOrderRepository,
      service,
    ).execute(ORDER_ID, "admin-1", Role.SUPER_ADMIN);
    await new CancelOrderUseCase(
      orderRepo(
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ) as unknown as IOrderRepository,
      service,
    ).execute(ORDER_ID, "user-1", Role.CLIENT);

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][0].message).toBe(
      "Tu pedido #7728950E fue cancelado.",
    );
  });
});
