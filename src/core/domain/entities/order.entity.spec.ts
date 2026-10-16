import { Prisma } from "@prisma/client";
import { OrderEntity } from "./order.entity";

const dec = (n: number) => new Prisma.Decimal(n);

const BASE = {
  id: "order-1",
  userId: "user-1",
  couponId: null,
  companyId: "company-1",
  branchId: null,
  departmentId: null,
  createdById: "user-1",
  deliveryAddressId: "address-1",
  deliveryDate: null,
  deliveryTime: null,
  notes: null,
  priority: "MEDIUM" as const,
  status: "CREATED" as const,
  subtotal: dec(100),
  discount: dec(0),
  total: dec(121),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function persisted(): OrderEntity {
  return OrderEntity.fromPrisma({
    ...BASE,
    tax: dec(16),
    shipping: dec(5),
    orderNumber: "OF-2026-0001",
    receiverName: "Ana",
    receiverPhone: "04125551234",
    addressDetail: null,
    addressReference: null,
    items: [],
  });
}

describe("OrderEntity.toResponseDto", () => {
  it("expone tax, shipping, orderNumber y el receptor", () => {
    expect(persisted().toResponseDto()).toMatchObject({
      tax: 16,
      shipping: 5,
      total: 121,
      orderNumber: "OF-2026-0001",
      receiverName: "Ana",
    });
  });

  it("maskPrices (OPERATOR) oculta también tax y shipping", () => {
    const dto = persisted().toResponseDto({ maskPrices: true });
    expect(dto).toMatchObject({
      subtotal: null,
      discount: null,
      tax: null,
      shipping: null,
      total: null,
    });
    // Lo que no es precio se sigue viendo.
    expect(dto.orderNumber).toBe("OF-2026-0001");
    expect(dto.receiverName).toBe("Ana");
  });

  it("fila sin columnas del checkout → tax/shipping 0 y el resto null", () => {
    const dto = OrderEntity.fromPrisma(BASE).toResponseDto();
    expect(dto).toMatchObject({
      tax: 0,
      shipping: 0,
      orderNumber: null,
      receiverName: null,
      addressReference: null,
    });
  });
});
