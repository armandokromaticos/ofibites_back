import { OrderStatus } from "../enums/order-status.enum";
import {
  getOrderStatusGroup,
  ORDER_IN_PROGRESS_STATUSES,
  ORDER_STATUSES_BY_GROUP,
  ORDER_TERMINAL_STATUSES,
  OrderStatusGroup,
} from "./order-status-groups";

describe("order-status-groups", () => {
  it.each([
    [OrderStatus.CREATED, OrderStatusGroup.RECEIVED],
    [OrderStatus.PENDING_APPROVAL, OrderStatusGroup.RECEIVED],
    [OrderStatus.PENDING_CONFIRMATION, OrderStatusGroup.RECEIVED],
    [OrderStatus.IN_ADJUSTMENT, OrderStatusGroup.RECEIVED],
    [OrderStatus.CONFIRMED, OrderStatusGroup.SCHEDULED],
    [OrderStatus.IN_PREPARATION, OrderStatusGroup.SCHEDULED],
    [OrderStatus.IN_TRANSIT, OrderStatusGroup.IN_TRANSIT],
    [OrderStatus.DELIVERED, OrderStatusGroup.DELIVERED],
    [OrderStatus.REJECTED, OrderStatusGroup.CANCELLED],
    [OrderStatus.CANCELLED, OrderStatusGroup.CANCELLED],
  ])("%s pertenece al grupo %s (DECISIONES 2026-10-20)", (status, group) => {
    expect(getOrderStatusGroup(status)).toBe(group);
  });

  it("cada OrderStatus aparece en exactamente un grupo de ORDER_STATUSES_BY_GROUP", () => {
    const allGrouped = Object.values(ORDER_STATUSES_BY_GROUP).flat();
    expect(allGrouped.sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it("ORDER_STATUSES_BY_GROUP es el reverso exacto de getOrderStatusGroup", () => {
    for (const status of Object.values(OrderStatus)) {
      const group = getOrderStatusGroup(status);
      expect(ORDER_STATUSES_BY_GROUP[group]).toContain(status);
    }
  });

  // T-31a: GET .../addresses/:id/blocking-orders filtra por este set.
  describe("ORDER_IN_PROGRESS_STATUSES", () => {
    it("excluye los estados terminales (DELIVERED, CANCELLED, REJECTED)", () => {
      expect(ORDER_IN_PROGRESS_STATUSES).not.toContain(OrderStatus.DELIVERED);
      expect(ORDER_IN_PROGRESS_STATUSES).not.toContain(OrderStatus.CANCELLED);
      expect(ORDER_IN_PROGRESS_STATUSES).not.toContain(OrderStatus.REJECTED);
    });

    it("incluye todo estado no terminal", () => {
      const nonTerminal = Object.values(OrderStatus).filter(
        (status) => !ORDER_TERMINAL_STATUSES.includes(status),
      );
      expect([...ORDER_IN_PROGRESS_STATUSES].sort()).toEqual(
        nonTerminal.sort(),
      );
    });

    it("es exactamente el complemento de ORDER_TERMINAL_STATUSES sobre todo OrderStatus", () => {
      const union = new Set([
        ...ORDER_IN_PROGRESS_STATUSES,
        ...ORDER_TERMINAL_STATUSES,
      ]);
      expect([...union].sort()).toEqual(Object.values(OrderStatus).sort());
      const intersection = ORDER_IN_PROGRESS_STATUSES.filter((status) =>
        ORDER_TERMINAL_STATUSES.includes(status),
      );
      expect(intersection).toEqual([]);
    });
  });
});
