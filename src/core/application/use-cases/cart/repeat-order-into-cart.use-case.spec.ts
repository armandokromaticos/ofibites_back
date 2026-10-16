import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  CART_REPEAT_REASONS,
  RepeatOrderIntoCartUseCase,
  toSkipReason,
} from "./repeat-order-into-cart.use-case";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import type { LineItemPricingService } from "../../services/line-item-pricing.service";
import type { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import type { CartViewService } from "../../services/cart-view.service";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { OrderPriority } from "../../../domain/enums/order-priority.enum";
import { Role } from "../../../domain/enums/role.enum";
import { Lang } from "../../../domain/enums/lang.enum";
import type { LineAvailabilityCode } from "../../../domain/services/line-availability";

const ORDER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

type Line = {
  productId: string;
  productSizeId?: string | null;
  comboId?: string | null;
  quantity: number;
  modifierIds?: string[];
};

function order(
  lines: Line[],
  overrides: { companyId?: string; userId?: string } = {},
) {
  return new OrderEntity({
    id: ORDER_ID,
    userId: overrides.userId ?? "owner-1",
    couponId: null,
    companyId: overrides.companyId ?? "company-1",
    branchId: null,
    departmentId: null,
    createdById: overrides.userId ?? "owner-1",
    deliveryAddressId: "address-1",
    deliveryDate: null,
    deliveryTime: null,
    notes: null,
    priority: OrderPriority.MEDIUM,
    status: OrderStatus.DELIVERED,
    subtotal: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    orderNumber: "OF-2026-0001",
    receiverName: null,
    receiverPhone: null,
    addressDetail: null,
    addressReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: lines.map((l, i) => ({
      id: `oi-${i}`,
      productId: l.productId,
      productSizeId: l.productSizeId ?? null,
      comboId: l.comboId ?? null,
      quantity: l.quantity,
      unitPrice: 1,
      subtotal: 1,
      modifiers: (l.modifierIds ?? []).map((modifierId) => ({
        id: undefined,
        modifierId,
        priceAdjustment: 0,
      })),
    })),
  });
}

interface SetupOptions {
  found?: OrderEntity | null;
  lastOrders?: OrderEntity[];
  /** productId (o comboId) → error que lanza la disponibilidad */
  /** productId (o comboId) → code que devuelve la regla única */
  availabilityCodes?: Record<string, LineAvailabilityCode>;
  pricingErrors?: Record<string, Error>;
  member?: boolean;
}

function setup(options: SetupOptions = {}) {
  const orderRepository = {
    findUnique: jest.fn(() => Promise.resolve(options.found ?? null)),
    findMany: jest.fn(() =>
      Promise.resolve({ data: options.lastOrders ?? [] }),
    ),
  };
  const cartRepository = {
    addItemsAtomically: jest.fn(() => Promise.resolve()),
    addItem: jest.fn(),
    incrementItemQuantity: jest.fn(),
  };
  const companyRepository = {
    findUnique: jest.fn(() => Promise.resolve({ isActive: true })),
  };
  const companyMemberRepository = {
    findActiveByUserAndCompany: jest.fn(() =>
      Promise.resolve(options.member ? { id: "member-1" } : null),
    ),
  };
  const productRepository = {
    findMany: jest.fn(() =>
      Promise.resolve({
        data: [
          { id: "p-off", nameEs: "Jugo verde", nameEn: "Green juice" },
          { id: "p-size", nameEs: "Bandeja de frutas", nameEn: null },
        ],
      }),
    ),
  };
  const comboRepository = {
    findMany: jest.fn(() =>
      Promise.resolve({
        data: [
          { id: "c-off", nameEs: "Combo oficina", nameEn: "Office combo" },
        ],
      }),
    ),
  };
  const keyOf = (input: { productId: string; comboId?: string | null }) =>
    input.comboId ?? input.productId;
  const availability = {
    check: jest.fn((input: { productId: string; comboId?: string | null }) => {
      const code = options.availabilityCodes?.[keyOf(input)];
      return Promise.resolve(code ? { code, message: "x" } : null);
    }),
  };
  const pricing = {
    priceLineItem: jest.fn(
      (input: { productId: string; comboId?: string | null }) => {
        const error = options.pricingErrors?.[keyOf(input)];
        return error
          ? Promise.reject(error)
          : Promise.resolve({ unitPrice: 1, subtotal: 1, modifiers: [] });
      },
    ),
  };
  const cartView = {
    build: jest.fn(() => Promise.resolve({ id: "cart-1", items: [] })),
  };

  const useCase = new RepeatOrderIntoCartUseCase(
    orderRepository as unknown as IOrderRepository,
    cartRepository as unknown as ICartRepository,
    companyRepository as unknown as ICompanyRepository,
    companyMemberRepository as unknown as ICompanyMemberRepository,
    productRepository as unknown as IProductRepository,
    comboRepository as unknown as IComboRepository,
    pricing as unknown as LineItemPricingService,
    availability as unknown as LineItemAvailabilityService,
    cartView as unknown as CartViewService,
  );
  return { useCase, orderRepository, cartRepository, cartView, pricing };
}

const buyer = { id: "buyer-1", role: Role.CLIENT };

describe("RepeatOrderIntoCartUseCase", () => {
  it("copia todas las líneas disponibles en una sola escritura atómica", async () => {
    const { useCase, cartRepository, cartView } = setup({
      found: order([
        {
          productId: "p-1",
          productSizeId: "s-1",
          quantity: 3,
          modifierIds: ["m-1"],
        },
        { productId: "p-2", comboId: "c-1", quantity: 1 },
      ]),
      member: true,
    });

    const result = await useCase.execute(
      "company-1",
      buyer,
      { orderId: ORDER_ID },
      Lang.EN,
    );

    expect(cartRepository.addItemsAtomically).toHaveBeenCalledTimes(1);
    expect(cartRepository.addItemsAtomically).toHaveBeenCalledWith(
      "company-1",
      [
        {
          productId: "p-1",
          productSizeId: "s-1",
          comboId: null,
          quantity: 3,
          modifierIds: ["m-1"],
          addedById: "buyer-1",
        },
        {
          productId: "p-2",
          productSizeId: null,
          comboId: "c-1",
          quantity: 1,
          modifierIds: [],
          addedById: "buyer-1",
        },
      ],
    );
    // Nada fuera de la transacción.
    expect(cartRepository.addItem).not.toHaveBeenCalled();
    expect(cartRepository.incrementItemQuantity).not.toHaveBeenCalled();
    expect(cartView.build).toHaveBeenCalledWith("company-1", Lang.EN);
    expect(result.added).toBe(2);
    expect(result.skipped).toEqual([]);
  });

  it("omite las líneas no disponibles con nombre y motivo en español", async () => {
    const { useCase, cartRepository } = setup({
      found: order([
        { productId: "p-1", quantity: 1 },
        { productId: "p-off", quantity: 2 },
        { productId: "p-size", productSizeId: "s-9", quantity: 1 },
        { productId: "p-2", comboId: "c-off", quantity: 1 },
        { productId: "p-gone", quantity: 1 },
      ]),
      member: true,
      availabilityCodes: {
        "p-off": "UNAVAILABLE",
        "p-size": "CONFIGURATION",
        "c-off": "UNAVAILABLE",
        "p-gone": "NOT_FOUND",
      },
    });

    const result = await useCase.execute("company-1", buyer, {
      orderId: ORDER_ID,
    });

    expect(result.added).toBe(1);
    expect(cartRepository.addItemsAtomically).toHaveBeenCalledWith(
      "company-1",
      [expect.objectContaining({ productId: "p-1" })],
    );
    expect(result.skipped).toEqual([
      {
        productId: "p-off",
        comboId: null,
        name: "Jugo verde",
        reason: CART_REPEAT_REASONS.UNAVAILABLE,
      },
      {
        productId: "p-size",
        comboId: null,
        name: "Bandeja de frutas",
        reason: CART_REPEAT_REASONS.CONFIGURATION,
      },
      {
        productId: "p-2",
        comboId: "c-off",
        name: "Combo oficina",
        reason: CART_REPEAT_REASONS.UNAVAILABLE,
      },
      {
        productId: "p-gone",
        comboId: null,
        name: "Producto no disponible",
        reason: CART_REPEAT_REASONS.NOT_FOUND,
      },
    ]);
  });

  it.each([
    ["UNAVAILABLE", "Ya no está disponible"],
    [
      "CONFIGURATION",
      "Ya no está disponible con el tamaño o los extras elegidos",
    ],
    ["NOT_FOUND", "Ya no existe en el catálogo"],
  ] as const)("el motivo sale del code %s → %s", async (code, reason) => {
    const { useCase } = setup({
      found: order([
        { productId: "p-1", quantity: 1 },
        { productId: "p-off", quantity: 1 },
      ]),
      member: true,
      availabilityCodes: { "p-off": code },
    });
    const result = await useCase.execute("company-1", buyer, {
      orderId: ORDER_ID,
    });
    expect(toSkipReason(code)).toBe(reason);
    expect(result.skipped[0].reason).toBe(reason);
  });

  it("red de seguridad de priceLineItem: 404 → NOT_FOUND, otro 400 → CONFIGURATION", async () => {
    const { useCase } = setup({
      found: order([
        { productId: "p-1", quantity: 1 },
        { productId: "p-anchor", comboId: "c-1", quantity: 1 },
        { productId: "p-odd", quantity: 1 },
      ]),
      member: true,
      pricingErrors: {
        "c-1": new NotFoundException("Product with id p-anchor not found"),
        "p-odd": new BadRequestException("algo raro"),
      },
    });
    const result = await useCase.execute("company-1", buyer, {
      orderId: ORDER_ID,
    });
    expect(result.skipped.map((s) => s.reason)).toEqual([
      CART_REPEAT_REASONS.NOT_FOUND,
      CART_REPEAT_REASONS.CONFIGURATION,
    ]);
  });

  it("copia combos y líneas con modificadores tal cual (modifierIds llega a la transacción)", async () => {
    const { useCase, cartRepository } = setup({
      found: order([
        { productId: "p-2", comboId: "c-1", quantity: 2 },
        {
          productId: "p-3",
          productSizeId: "s-3",
          quantity: 1,
          modifierIds: ["m-2", "m-1"],
        },
      ]),
      member: true,
    });
    await useCase.execute("company-1", buyer, { orderId: ORDER_ID });
    const [, lines] = cartRepository.addItemsAtomically.mock
      .calls[0] as unknown as [
      string,
      { comboId: string | null; modifierIds: string[]; quantity: number }[],
    ];
    expect(lines[0]).toMatchObject({
      comboId: "c-1",
      modifierIds: [],
      quantity: 2,
    });
    expect(lines[1]).toMatchObject({
      comboId: null,
      modifierIds: ["m-2", "m-1"],
    });
  });

  it("400 sin tocar el carrito si ninguna línea es copiable", async () => {
    const { useCase, cartRepository } = setup({
      found: order([{ productId: "p-off", quantity: 1 }]),
      member: true,
      availabilityCodes: { "p-off": "UNAVAILABLE" },
    });

    await expect(
      useCase.execute("company-1", buyer, { orderId: ORDER_ID }),
    ).rejects.toThrow(
      "Ningún producto del pedido sigue disponible para añadir al carrito",
    );
    expect(cartRepository.addItemsAtomically).not.toHaveBeenCalled();
  });

  it("400 si el pedido no tiene líneas", async () => {
    const { useCase } = setup({ found: order([]), member: true });
    await expect(
      useCase.execute("company-1", buyer, { orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404 si el pedido es de otra empresa (aislamiento), aunque exista", async () => {
    const { useCase, cartRepository } = setup({
      found: order([{ productId: "p-1", quantity: 1 }], {
        companyId: "company-2",
      }),
      member: true,
    });

    await expect(
      useCase.execute(
        "company-1",
        { id: "admin", role: Role.SUPER_ADMIN },
        {
          orderId: ORDER_ID,
        },
      ),
    ).rejects.toThrow(
      new NotFoundException("Pedido no encontrado en esta empresa"),
    );
    expect(cartRepository.addItemsAtomically).not.toHaveBeenCalled();
  });

  it("404 si el pedido no existe", async () => {
    const { useCase } = setup({ found: null });
    await expect(
      useCase.execute("company-1", buyer, { orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403 con las reglas de GET /orders/:id (cliente que no es dueño ni miembro)", async () => {
    const { useCase, cartRepository } = setup({
      found: order([{ productId: "p-1", quantity: 1 }]),
      member: false,
    });

    await expect(
      useCase.execute("company-1", buyer, { orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cartRepository.addItemsAtomically).not.toHaveBeenCalled();
  });

  it("el dueño del pedido puede repetirlo", async () => {
    const { useCase } = setup({
      found: order([{ productId: "p-1", quantity: 1 }]),
      member: false,
    });
    const result = await useCase.execute(
      "company-1",
      { id: "owner-1", role: Role.CLIENT },
      { orderId: ORDER_ID },
    );
    expect(result.added).toBe(1);
  });

  it("last: busca el último pedido propio de la empresa, sin cancelados ni rechazados", async () => {
    const { useCase, orderRepository } = setup({
      lastOrders: [
        order([{ productId: "p-1", quantity: 2 }], { userId: "buyer-1" }),
      ],
    });

    const result = await useCase.execute("company-1", buyer, { last: true });

    expect(orderRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          userId: "buyer-1",
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    );
    expect(orderRepository.findUnique).not.toHaveBeenCalled();
    expect(result.added).toBe(1);
  });

  it("last: 404 si no hay pedidos", async () => {
    const { useCase } = setup({ lastOrders: [] });
    await expect(
      useCase.execute("company-1", buyer, { last: true }),
    ).rejects.toThrow("No tienes pedidos para repetir en esta empresa");
  });
});
