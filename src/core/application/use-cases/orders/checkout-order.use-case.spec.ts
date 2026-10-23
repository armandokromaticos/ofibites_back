import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { CheckoutOrderUseCase } from "./checkout-order.use-case";
import { CartEntity, CartItemInfo } from "../../../domain/entities/cart.entity";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { CartChangedException } from "../../../domain/exceptions/cart-changed.exception";
import { Role } from "../../../domain/enums/role.enum";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import type {
  LineItemInput,
  LineItemPricingService,
} from "../../services/line-item-pricing.service";
import type { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import { CheckoutOrderDto } from "../../dto/orders/checkout-order.dto";

const COMPANY = "company-1";
const ACTOR = { id: "user-1", role: Role.CLIENT };
// Hoy en Caracas: 2026-10-16, 10:00.
const NOW = new Date("2026-10-16T10:00:00.000-04:00");

/** Precio del servidor por producto (lo que diga el catálogo, no el cliente). */
const SERVER_PRICES: Record<string, number> = { "p-1": 50, "p-2": 12.5 };

function cartItem(
  id: string,
  productId: string,
  quantity: number,
  name = `Producto ${productId}`,
): CartItemInfo {
  return {
    id,
    productId,
    productSizeId: null,
    comboId: null,
    quantity,
    addedById: "user-1",
    modifierIds: [],
    display: {
      nameEs: name,
      nameEn: null,
      image: null,
      sizeNameEs: null,
      sizeNameEn: null,
      servings: null,
      isAvailable: true,
    },
  } as CartItemInfo;
}

function cart(items: CartItemInfo[]): CartEntity {
  return new CartEntity({
    id: "cart-1",
    companyId: COMPANY,
    items,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function persisted(entity: OrderEntity): OrderEntity {
  // Simula lo que devuelve Prisma tras crear: id, número y ids de líneas.
  return new OrderEntity({
    id: "order-1",
    userId: entity.userId,
    couponId: null,
    companyId: entity.companyId,
    branchId: null,
    departmentId: null,
    createdById: entity.createdById,
    deliveryAddressId: entity.deliveryAddressId,
    deliveryDate: entity.deliveryDate,
    deliveryTime: entity.deliveryTime,
    notes: entity.notes,
    priority: entity.priority,
    status: entity.status,
    subtotal: entity.subtotal,
    discount: entity.discount,
    tax: entity.tax,
    shipping: entity.shipping,
    total: entity.total,
    orderNumber: "OF-2026-0007",
    receiverName: entity.receiverName,
    receiverPhone: entity.receiverPhone,
    addressDetail: entity.addressDetail,
    addressReference: entity.addressReference,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items: (entity.items ?? []).map((item, i) => ({ ...item, id: `oi-${i}` })),
  });
}

function setup(
  options: {
    items?: CartItemInfo[];
    address?: { companyId: string; isShipping: boolean } | null;
    unavailable?: string[];
    /** productId → error con que falla su cotización. */
    priceErrors?: Record<string, Error>;
  } = {},
) {
  const items = options.items ?? [
    cartItem("ci-1", "p-1", 2),
    cartItem("ci-2", "p-2", 1),
  ];
  const orderRepository = {
    createFromCart: jest.fn((entity: OrderEntity) =>
      Promise.resolve(persisted(entity)),
    ),
  };
  const cartRepository = {
    getOrCreateViewByCompanyId: jest.fn(() => Promise.resolve(cart(items))),
  };
  const addressRepository = {
    findUnique: jest.fn(() =>
      Promise.resolve(
        options.address === undefined
          ? { companyId: COMPANY, isShipping: true }
          : options.address,
      ),
    ),
  };
  const priceErrors = options.priceErrors ?? {};
  // Única vía de cotización del checkout: un lote con un resultado por línea.
  const pricing = {
    priceLinesSettled: jest.fn((inputs: LineItemInput[]) =>
      Promise.resolve(
        inputs.map((input): PromiseSettledResult<unknown> => {
          const error = priceErrors[input.productId];
          if (error) return { status: "rejected", reason: error };
          const unitPrice = SERVER_PRICES[input.productId];
          return {
            status: "fulfilled",
            value: {
              unitPrice,
              subtotal: Math.round(unitPrice * input.quantity * 100) / 100,
              modifiers: [],
            },
          };
        }),
      ),
    ),
  };
  const unavailable = new Set(options.unavailable ?? []);
  const availability = {
    checkMany: jest.fn((inputs: LineItemInput[]) =>
      Promise.resolve(
        inputs.map((input) =>
          unavailable.has(input.productId)
            ? { code: "UNAVAILABLE" as const, message: "no disponible" }
            : null,
        ),
      ),
    ),
  };
  const useCase = new CheckoutOrderUseCase(
    orderRepository as unknown as IOrderRepository,
    cartRepository as unknown as ICartRepository,
    {
      findUnique: jest.fn(() => Promise.resolve({ isActive: true })),
    } as unknown as ICompanyRepository,
    addressRepository as unknown as ICompanyAddressRepository,
    pricing as unknown as LineItemPricingService,
    availability as unknown as LineItemAvailabilityService,
  );
  return { useCase, orderRepository, cartRepository, pricing, availability };
}

const dto = (overrides: Partial<CheckoutOrderDto> = {}): CheckoutOrderDto =>
  ({
    deliveryAddressId: "address-1",
    deliveryDate: "2026-10-17",
    deliveryTime: "10:30",
    receiverName: "María Pérez",
    receiverPhone: "+58 412-555-1234",
    addressDetail: "Piso 3",
    addressReference: "Frente a la plaza",
    notes: "Tocar en recepción",
    ...overrides,
  }) as CheckoutOrderDto;

describe("CheckoutOrderUseCase", () => {
  const ORIGINAL_FEE = process.env.SHIPPING_FLAT_FEE;
  afterEach(() => {
    if (ORIGINAL_FEE === undefined) delete process.env.SHIPPING_FLAT_FEE;
    else process.env.SHIPPING_FLAT_FEE = ORIGINAL_FEE;
  });

  it("crea el pedido con precios del servidor, IVA, envío y datos del receptor", async () => {
    const { useCase, orderRepository, pricing } = setup();

    const order = await useCase.execute(COMPANY, ACTOR, dto(), NOW);

    // 2 × 50 + 1 × 12,5 = 112,5 → IVA 18, envío 5 (< 150), total 135,5
    expect(pricing.priceLinesSettled).toHaveBeenCalledWith([
      expect.objectContaining({ productId: "p-1", quantity: 2 }),
      expect.objectContaining({ productId: "p-2", quantity: 1 }),
    ]);
    expect(order.subtotal).toBe(112.5);
    expect(order.discount).toBe(0);
    expect(order.tax).toBe(18);
    expect(order.shipping).toBe(5);
    expect(order.total).toBe(135.5);
    expect(order.items?.map((i) => [i.productId, i.unitPrice])).toEqual([
      ["p-1", 50],
      ["p-2", 12.5],
    ]);
    expect(order.orderNumber).toBe("OF-2026-0007");
    expect(order.status).toBe("CREATED");
    expect(order.toResponseDto()).toMatchObject({
      orderNumber: "OF-2026-0007",
      receiverName: "María Pérez",
      receiverPhone: "+58 412-555-1234",
      addressDetail: "Piso 3",
      addressReference: "Frente a la plaza",
      notes: "Tocar en recepción",
      deliveryTime: "10:30",
      tax: 18,
      shipping: 5,
      total: 135.5,
    });
    expect(order.deliveryDate?.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(orderRepository.createFromCart).toHaveBeenCalledTimes(1);
  });

  it("vacía el carrito: pasa al repositorio exactamente las líneas tarificadas", async () => {
    const { useCase, orderRepository } = setup();

    await useCase.execute(COMPANY, ACTOR, dto(), NOW);

    expect(orderRepository.createFromCart).toHaveBeenCalledWith(
      expect.any(OrderEntity),
      {
        cartId: "cart-1",
        items: [
          { id: "ci-1", quantity: 2 },
          { id: "ci-2", quantity: 1 },
        ],
      },
    );
  });

  it("con base ≥ 150 el envío es gratis", async () => {
    const { useCase } = setup({ items: [cartItem("ci-1", "p-1", 3)] });
    const order = await useCase.execute(COMPANY, ACTOR, dto(), NOW);
    expect(order.subtotal).toBe(150);
    expect(order.shipping).toBe(0);
    expect(order.total).toBe(174);
  });

  it("respeta SHIPPING_FLAT_FEE", async () => {
    process.env.SHIPPING_FLAT_FEE = "8.5";
    const { useCase } = setup({ items: [cartItem("ci-1", "p-2", 1)] });
    const order = await useCase.execute(COMPANY, ACTOR, dto(), NOW);
    expect(order.shipping).toBe(8.5);
    expect(order.total).toBe(12.5 + 2 + 8.5);
  });

  describe("aislamiento por empresa", () => {
    it("usa solo el carrito de la empresa del header", async () => {
      const { useCase, cartRepository } = setup();
      await useCase.execute(COMPANY, ACTOR, dto(), NOW);
      expect(cartRepository.getOrCreateViewByCompanyId).toHaveBeenCalledWith(
        COMPANY,
      );
    });

    it("dirección de otra empresa → 404 sin tocar el carrito", async () => {
      const { useCase, orderRepository, cartRepository } = setup({
        address: { companyId: "company-2", isShipping: true },
      });
      await expect(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(cartRepository.getOrCreateViewByCompanyId).not.toHaveBeenCalled();
      expect(orderRepository.createFromCart).not.toHaveBeenCalled();
    });

    it("dirección inexistente → 404", async () => {
      const { useCase } = setup({ address: null });
      await expect(useCase.execute(COMPANY, ACTOR, dto(), NOW)).rejects.toThrow(
        "Dirección de entrega no encontrada en esta empresa",
      );
    });

    it("dirección que no es de entrega → 400", async () => {
      const { useCase } = setup({
        address: { companyId: COMPANY, isShipping: false },
      });
      await expect(useCase.execute(COMPANY, ACTOR, dto(), NOW)).rejects.toThrow(
        "La dirección elegida no está habilitada para entregas",
      );
    });
  });

  it("carrito vacío → 400", async () => {
    const { useCase, orderRepository } = setup({ items: [] });
    await expect(useCase.execute(COMPANY, ACTOR, dto(), NOW)).rejects.toThrow(
      "El carrito está vacío",
    );
    expect(orderRepository.createFromCart).not.toHaveBeenCalled();
  });

  it("línea no disponible → 400 con la lista de líneas, sin crear", async () => {
    const { useCase, orderRepository } = setup({
      items: [
        cartItem("ci-1", "p-1", 1, "Café"),
        cartItem("ci-2", "p-2", 1, "Croissant"),
      ],
      unavailable: ["p-2"],
    });

    const error = await useCase
      .execute(COMPANY, ACTOR, dto(), NOW)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message:
        "Algunos productos del carrito ya no están disponibles. Quítalos para confirmar el pedido",
      code: "CART_ITEMS_UNAVAILABLE",
      unavailableItems: [
        {
          cartItemId: "ci-2",
          productId: "p-2",
          comboId: null,
          name: "Croissant",
          reason: "Ya no está disponible",
        },
      ],
    });
    expect(orderRepository.createFromCart).not.toHaveBeenCalled();
  });

  it("una línea que ya no se puede cotizar (404 del pricing) también se lista", async () => {
    const { useCase } = setup({
      items: [cartItem("ci-1", "p-1", 1, "Café")],
      priceErrors: { "p-1": new NotFoundException("Product not found") },
    });
    const error = (await useCase
      .execute(COMPANY, ACTOR, dto(), NOW)
      .catch((e: unknown) => e)) as BadRequestException;
    expect(error.getResponse()).toMatchObject({
      unavailableItems: [
        { cartItemId: "ci-1", reason: "Ya no existe en el catálogo" },
      ],
    });
  });

  it("otro 4xx del pricing → CONFIGURATION; la regla de disponibilidad manda sobre el pricing", async () => {
    const { useCase } = setup({
      unavailable: ["p-2"],
      priceErrors: {
        "p-1": new BadRequestException("Modifier m-1 is not available"),
        "p-2": new NotFoundException("Product not found"),
      },
    });
    const error = (await useCase
      .execute(COMPANY, ACTOR, dto(), NOW)
      .catch((e: unknown) => e)) as BadRequestException;
    expect(error.getResponse()).toMatchObject({
      code: "CART_ITEMS_UNAVAILABLE",
      unavailableItems: [
        {
          cartItemId: "ci-1",
          reason: "Ya no está disponible con el tamaño o los extras elegidos",
        },
        { cartItemId: "ci-2", reason: "Ya no está disponible" },
      ],
    });
  });

  it("un error del pricing que no es HTTP (BD) se propaga tal cual", async () => {
    const { useCase, orderRepository } = setup({
      priceErrors: { "p-2": new Error("BD caída") },
    });
    await expect(useCase.execute(COMPANY, ACTOR, dto(), NOW)).rejects.toThrow(
      "BD caída",
    );
    expect(orderRepository.createFromCart).not.toHaveBeenCalled();
  });

  it("cotiza una sola vez: un lote de disponibilidad y otro de precio, y guarda ese precio", async () => {
    const { useCase, pricing, availability, orderRepository } = setup();

    await useCase.execute(COMPANY, ACTOR, dto({ expectedTotal: 135.5 }), NOW);

    expect(availability.checkMany).toHaveBeenCalledTimes(1);
    expect(pricing.priceLinesSettled).toHaveBeenCalledTimes(1);
    const [saved] = orderRepository.createFromCart.mock.calls[0];
    expect(saved.items?.map((i) => [i.unitPrice, i.subtotal])).toEqual([
      [50, 100],
      [12.5, 12.5],
    ]);
  });

  describe("corte de entrega (hora de Caracas)", () => {
    const at = (time: string) => new Date(`2026-10-16T${time}:00.000-04:00`);

    it.each([
      ["hoy, por la mañana", "2026-10-16", "08:00", false],
      ["mañana antes de las 15:00", "2026-10-17", "14:59", true],
      ["mañana a las 15:00", "2026-10-17", "15:00", false],
      ["mañana después de las 15:00", "2026-10-17", "18:00", false],
      ["pasado mañana después de las 15:00", "2026-10-18", "18:00", true],
    ])("%s → %s", async (_label, deliveryDate, time, ok) => {
      const { useCase, orderRepository } = setup();
      const run = useCase.execute(
        COMPANY,
        ACTOR,
        dto({ deliveryDate }),
        at(time),
      );
      if (ok) {
        await expect(run).resolves.toBeInstanceOf(OrderEntity);
      } else {
        await expect(run).rejects.toBeInstanceOf(BadRequestException);
        expect(orderRepository.createFromCart).not.toHaveBeenCalled();
      }
    });

    it("usa la hora real si no se pasa now (fecha simulada con fake timers)", async () => {
      jest.useFakeTimers().setSystemTime(at("15:30"));
      try {
        const { useCase } = setup();
        await expect(
          useCase.execute(COMPANY, ACTOR, dto({ deliveryDate: "2026-10-17" })),
        ).rejects.toThrow(/hasta las 3:00 p\.m\./);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("code estable en el cuerpo de cada error", () => {
    /** Ejecuta y devuelve status + cuerpo de la excepción HTTP. */
    async function failure(
      run: Promise<unknown>,
    ): Promise<{ status: number; body: Record<string, unknown> }> {
      const error = (await run.catch((e: unknown) => e)) as HttpException;
      expect(error).toBeInstanceOf(HttpException);
      return {
        status: error.getStatus(),
        body: error.getResponse() as Record<string, unknown>,
      };
    }

    it.each([
      ["hoy", "2026-10-16", "10:00"],
      ["mañana después de las 15:00", "2026-10-17", "15:30"],
    ])("DELIVERY_CUTOFF (%s)", async (_label, deliveryDate, time) => {
      const { useCase } = setup();
      const { status, body } = await failure(
        useCase.execute(
          COMPANY,
          ACTOR,
          dto({ deliveryDate }),
          new Date(`2026-10-16T${time}:00.000-04:00`),
        ),
      );
      expect(status).toBe(400);
      expect(body).toMatchObject({
        statusCode: 400,
        error: "Bad Request",
        code: "DELIVERY_CUTOFF",
      });
      expect(typeof body.message).toBe("string");
    });

    it("DELIVERY_HORIZON (más de 90 días)", async () => {
      const { useCase } = setup();
      const { status, body } = await failure(
        useCase.execute(
          COMPANY,
          ACTOR,
          dto({ deliveryDate: "2027-01-15" }),
          NOW,
        ),
      );
      expect(status).toBe(400);
      expect(body).toMatchObject({
        code: "DELIVERY_HORIZON",
        message:
          "La fecha de entrega no puede ser más de 90 días después de hoy",
      });
    });

    it("CART_EMPTY", async () => {
      const { useCase } = setup({ items: [] });
      const { status, body } = await failure(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      );
      expect(status).toBe(400);
      expect(body).toMatchObject({
        code: "CART_EMPTY",
        message: "El carrito está vacío",
      });
    });

    it("CART_ITEMS_UNAVAILABLE (con unavailableItems)", async () => {
      const { useCase } = setup({ unavailable: ["p-1"] });
      const { status, body } = await failure(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      );
      expect(status).toBe(400);
      expect(body.code).toBe("CART_ITEMS_UNAVAILABLE");
      expect(body.unavailableItems).toHaveLength(1);
    });

    it("ADDRESS_NOT_SHIPPING", async () => {
      const { useCase } = setup({
        address: { companyId: COMPANY, isShipping: false },
      });
      const { status, body } = await failure(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      );
      expect(status).toBe(400);
      expect(body).toMatchObject({
        code: "ADDRESS_NOT_SHIPPING",
        message: "La dirección elegida no está habilitada para entregas",
      });
    });

    it("CART_CHANGED (409)", async () => {
      const { useCase, orderRepository } = setup();
      orderRepository.createFromCart.mockRejectedValueOnce(
        new CartChangedException("cart-1"),
      );
      const { status, body } = await failure(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      );
      expect(status).toBe(409);
      expect(body).toEqual({
        statusCode: 409,
        error: "Conflict",
        code: "CART_CHANGED",
        message:
          "El carrito cambió mientras confirmabas el pedido. Revísalo y vuelve a confirmar",
      });
    });

    it("TOTAL_CHANGED (409)", async () => {
      const { useCase } = setup();
      const { status, body } = await failure(
        useCase.execute(COMPANY, ACTOR, dto({ expectedTotal: 1 }), NOW),
      );
      expect(status).toBe(409);
      expect(body).toEqual({
        statusCode: 409,
        error: "Conflict",
        code: "TOTAL_CHANGED",
        message:
          "Los precios o el total del pedido cambiaron desde que lo revisaste. Revísalo y vuelve a confirmar",
      });
    });

    it("el 404 de dirección no lleva code (no lo distingue el front)", async () => {
      const { useCase } = setup({ address: null });
      const error = (await useCase
        .execute(COMPANY, ACTOR, dto(), NOW)
        .catch((e: unknown) => e)) as NotFoundException;
      expect(error.getResponse()).not.toHaveProperty("code");
    });
  });

  describe("expectedTotal", () => {
    it("igual al total recalculado → crea el pedido", async () => {
      const { useCase, orderRepository } = setup();
      await useCase.execute(COMPANY, ACTOR, dto({ expectedTotal: 135.5 }), NOW);
      expect(orderRepository.createFromCart).toHaveBeenCalledTimes(1);
    });

    it("distinto (p. ej. cambió un precio) → 409 sin crear", async () => {
      const { useCase, orderRepository } = setup();
      const run = useCase.execute(
        COMPANY,
        ACTOR,
        dto({ expectedTotal: 130 }),
        NOW,
      );
      await expect(run).rejects.toBeInstanceOf(ConflictException);
      await expect(run).rejects.toThrow(/Los precios o el total/);
      expect(orderRepository.createFromCart).not.toHaveBeenCalled();
    });

    it("omitido → no se compara", async () => {
      const { useCase } = setup();
      await expect(
        useCase.execute(COMPANY, ACTOR, dto(), NOW),
      ).resolves.toBeInstanceOf(OrderEntity);
    });
  });

  it("si el carrito cambió durante la transacción → 409 (nada se guarda)", async () => {
    const { useCase, orderRepository } = setup();
    orderRepository.createFromCart.mockRejectedValueOnce(
      new CartChangedException("cart-1"),
    );
    await expect(
      useCase.execute(COMPANY, ACTOR, dto(), NOW),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("otros errores del repositorio se propagan tal cual", async () => {
    const { useCase, orderRepository } = setup();
    orderRepository.createFromCart.mockRejectedValueOnce(new Error("BD caída"));
    await expect(useCase.execute(COMPANY, ACTOR, dto(), NOW)).rejects.toThrow(
      "BD caída",
    );
  });
});
