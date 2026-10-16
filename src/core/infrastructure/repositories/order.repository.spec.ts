import {
  buildCheckoutCartDeleteQuery,
  nextOrderNumber,
  OrderRepository,
} from "./order.repository";
import type { PrismaService } from "../database/prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import { OrderEntity } from "../../domain/entities/order.entity";
import { CartChangedException } from "../../domain/exceptions/cart-changed.exception";

interface CartRow {
  id: string;
  cartId: string;
  quantity: number;
}

/**
 * BD en memoria con lo justo para estas pruebas: transacciones serializadas
 * (como el bloqueo de fila del contador y de las líneas del carrito en
 * Postgres) y rollback si el callback lanza.
 */
function fakeDb(initial: {
  cartItems?: CartRow[];
  counters?: [number, number][];
}) {
  const state = {
    cartItems: [...(initial.cartItems ?? [])],
    counters: new Map<number, number>(initial.counters ?? []),
    orders: [] as { orderNumber: string }[],
    cartTouched: 0,
  };
  let queue: Promise<unknown> = Promise.resolve();

  function client(s: typeof state) {
    return {
      $queryRaw: jest.fn((_strings: TemplateStringsArray, year: number) => {
        const next = (s.counters.get(year) ?? 0) + 1;
        s.counters.set(year, next);
        return Promise.resolve([{ last_value: next }]);
      }),
      // DELETE de buildCheckoutCartDeleteQuery: values = [cartId, id1, q1, id2, q2…]
      $executeRaw: jest.fn((query: Prisma.Sql) => {
        const [cartId, ...rest] = query.values as (string | number)[];
        const pairs: { id: string; quantity: number }[] = [];
        for (let i = 0; i < rest.length; i += 2) {
          pairs.push({
            id: rest[i] as string,
            quantity: rest[i + 1] as number,
          });
        }
        const match = (row: CartRow) =>
          row.cartId === cartId &&
          pairs.some((c) => c.id === row.id && c.quantity === row.quantity);
        const count = s.cartItems.filter(match).length;
        s.cartItems = s.cartItems.filter((row) => !match(row));
        return Promise.resolve(count);
      }),
      cart: {
        update: jest.fn(() => {
          s.cartTouched += 1;
          return Promise.resolve({});
        }),
      },
      order: {
        create: jest.fn(({ data }: { data: Prisma.OrderCreateInput }) => {
          const row = orderRow(data.orderNumber ?? null);
          s.orders.push({ orderNumber: data.orderNumber as string });
          return Promise.resolve(row);
        }),
      },
    };
  }

  const prisma = {
    $transaction: jest.fn(
      (fn: (tx: ReturnType<typeof client>) => Promise<unknown>) => {
        const run = queue.then(async () => {
          const draft = {
            cartItems: [...state.cartItems],
            counters: new Map(state.counters),
            orders: [...state.orders],
            cartTouched: state.cartTouched,
          };
          const result = await fn(client(draft)); // si lanza, no se aplica
          Object.assign(state, draft);
          return result;
        });
        queue = run.catch(() => undefined);
        return run;
      },
    ),
  };

  return {
    state,
    repo: new OrderRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

function orderRow(orderNumber: string | null) {
  return {
    id: `order-${orderNumber ?? "x"}`,
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
    priority: "MEDIUM",
    status: "CREATED",
    subtotal: 10,
    discount: 0,
    tax: 1.6,
    shipping: 5,
    total: 16.6,
    orderNumber,
    receiverName: null,
    receiverPhone: null,
    addressDetail: null,
    addressReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };
}

function newOrder(): OrderEntity {
  return OrderEntity.fromCreateDto({
    userId: "user-1",
    companyId: "company-1",
    createdById: "user-1",
    deliveryAddressId: "address-1",
    subtotal: 10,
    discount: 0,
    tax: 1.6,
    shipping: 5,
    total: 16.6,
    items: [
      {
        productId: "p-1",
        quantity: 1,
        unitPrice: 10,
        subtotal: 10,
        modifiers: [],
      },
    ],
  });
}

const SNAPSHOT = {
  cartId: "cart-1",
  items: [
    { id: "ci-1", quantity: 2 },
    { id: "ci-2", quantity: 1 },
  ],
};
const CART_ROWS: CartRow[] = [
  { id: "ci-1", cartId: "cart-1", quantity: 2 },
  { id: "ci-2", cartId: "cart-1", quantity: 1 },
];

describe("nextOrderNumber", () => {
  it("usa el año de Caracas y el valor devuelto por el contador", async () => {
    const tx = {
      $queryRaw: jest.fn(() => Promise.resolve([{ last_value: 42 }])),
    };
    const number = await nextOrderNumber(
      tx as unknown as Prisma.TransactionClient,
      new Date("2026-06-01T12:00:00.000Z"),
    );
    expect(number).toBe("OF-2026-0042");
    expect(tx.$queryRaw.mock.calls[0]).toContain(2026);
  });

  it("cambio de año: la noche del 31 de diciembre en Caracas sigue en el año viejo", async () => {
    const { repo, state } = fakeDb({ counters: [[2026, 117]] });
    jest.useFakeTimers().setSystemTime(new Date("2027-01-01T03:30:00.000Z"));
    try {
      const a = await repo.create(newOrder()); // 31-dic 23:30 Caracas
      jest.setSystemTime(new Date("2027-01-01T04:00:00.000Z")); // 1-ene 00:00
      const b = await repo.create(newOrder());
      const c = await repo.create(newOrder());
      expect([a.orderNumber, b.orderNumber, c.orderNumber]).toEqual([
        "OF-2026-0118",
        "OF-2027-0001",
        "OF-2027-0002",
      ]);
      expect(state.counters.get(2027)).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("OrderRepository.create", () => {
  it("dos creaciones simultáneas reciben números distintos y consecutivos", async () => {
    const { repo } = fakeDb({ counters: [[2026, 9]] });
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    jest.setSystemTime(new Date("2026-10-16T14:00:00.000Z"));
    try {
      const [a, b] = await Promise.all([
        repo.create(newOrder()),
        repo.create(newOrder()),
      ]);
      expect(new Set([a.orderNumber, b.orderNumber])).toEqual(
        new Set(["OF-2026-0010", "OF-2026-0011"]),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("OrderRepository.createFromCart", () => {
  it("borra las líneas, numera y crea el pedido en una sola transacción", async () => {
    const { repo, state, prisma } = fakeDb({ cartItems: CART_ROWS });

    const order = await repo.createFromCart(newOrder(), SNAPSHOT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(order.orderNumber).toMatch(/^OF-\d{4}-0001$/);
    expect(state.cartItems).toEqual([]);
    expect(state.orders).toHaveLength(1);
    expect(state.cartTouched).toBe(1); // Cart.updatedAt
  });

  it("el borrado es un único DELETE parametrizado por (id, quantity)", () => {
    const query = buildCheckoutCartDeleteQuery(SNAPSHOT);
    expect(query.sql.replace(/\s+/g, " ")).toBe(
      `DELETE FROM "cart_items" WHERE "cart_id" = ? AND ("id", "quantity") IN ((?, ?),(?, ?))`,
    );
    expect(query.values).toEqual(["cart-1", "ci-1", 2, "ci-2", 1]);
  });

  it("deja en el carrito las líneas que no estaban en el snapshot", async () => {
    const extra = { id: "ci-3", cartId: "cart-1", quantity: 4 };
    const { repo, state } = fakeDb({ cartItems: [...CART_ROWS, extra] });

    await repo.createFromCart(newOrder(), SNAPSHOT);

    expect(state.cartItems).toEqual([extra]);
  });

  it("si una cantidad cambió, revierte todo: ni pedido, ni número, ni borrado", async () => {
    const { repo, state } = fakeDb({
      cartItems: [CART_ROWS[0], { ...CART_ROWS[1], quantity: 3 }],
      counters: [[2026, 5]],
    });

    await expect(
      repo.createFromCart(newOrder(), SNAPSHOT),
    ).rejects.toBeInstanceOf(CartChangedException);

    expect(state.cartItems).toHaveLength(2);
    expect(state.orders).toHaveLength(0);
    expect(state.counters.get(2026)).toBe(5);
  });

  it("si falla la creación del pedido, el carrito no se vacía", async () => {
    const { repo, state, prisma } = fakeDb({ cartItems: CART_ROWS });
    prisma.$transaction.mockImplementationOnce(() =>
      Promise.reject(new Error("FK rota")),
    );

    await expect(repo.createFromCart(newOrder(), SNAPSHOT)).rejects.toThrow(
      "FK rota",
    );
    expect(state.cartItems).toHaveLength(2);
  });

  it("dos checkouts simultáneos del mismo carrito: uno crea el pedido y el otro recibe CartChangedException", async () => {
    const { repo, state } = fakeDb({ cartItems: CART_ROWS });

    const results = await Promise.allSettled([
      repo.createFromCart(newOrder(), SNAPSHOT),
      repo.createFromCart(newOrder(), SNAPSHOT),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(CartChangedException);
    expect(state.orders).toHaveLength(1);
    expect(state.cartItems).toEqual([]);
  });

  it("snapshot vacío nunca crea pedido", async () => {
    const { repo, state } = fakeDb({ cartItems: [] });
    await expect(
      repo.createFromCart(newOrder(), { cartId: "cart-1", items: [] }),
    ).rejects.toBeInstanceOf(CartChangedException);
    expect(state.orders).toHaveLength(0);
  });
});
