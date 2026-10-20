import { OrderStatus } from "../enums/order-status.enum";
import {
  getOrderStatusGroup,
  ORDER_STATUSES_BY_GROUP,
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
});
