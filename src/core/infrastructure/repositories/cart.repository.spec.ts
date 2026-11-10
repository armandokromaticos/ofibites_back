import { CartRepository } from "./cart.repository";
import type { PrismaService } from "../database/prisma/prisma.service";

function setup(
  existing: { id: string; productId: string; modifierIds?: string[] }[],
) {
  let created = 0;
  const tx = {
    cart: {
      upsert: jest.fn(() =>
        Promise.resolve({
          id: "cart-1",
          items: existing.map((e) => ({
            id: e.id,
            productId: e.productId,
            productSizeId: null,
            comboId: null,
            modifiers: (e.modifierIds ?? []).map((modifierId) => ({
              modifierId,
            })),
          })),
        }),
      ),
    },
    cartItem: {
      update: jest.fn(() => Promise.resolve({})),
      create: jest.fn(() => Promise.resolve({ id: `new-${++created}` })),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    cartItem: { create: jest.fn(), update: jest.fn() },
  };
  const repo = new CartRepository(prisma as unknown as PrismaService);
  return { repo, prisma, tx };
}

describe("CartRepository.addItemsAtomically", () => {
  it("suma a la línea existente, crea las nuevas y agrupa duplicados, todo en la transacción", async () => {
    const { repo, prisma, tx } = setup([{ id: "item-1", productId: "p-1" }]);

    await repo.addItemsAtomically("company-1", "user-1", [
      { productId: "p-1", quantity: 2, modifierIds: [] },
      { productId: "p-2", quantity: 1, modifierIds: ["m-1"], addedById: "u-1" },
      { productId: "p-2", quantity: 4, modifierIds: ["m-1"], addedById: "u-1" },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_userId: { companyId: "company-1", userId: "user-1" },
        },
        create: { companyId: "company-1", userId: "user-1" },
      }),
    );
    expect(tx.cartItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: "item-1" },
      data: { quantity: { increment: 2 } },
    });
    expect(tx.cartItem.create).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: "new-1" },
      data: { quantity: { increment: 4 } },
    });
    // Nada por fuera del cliente transaccional.
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it("si una escritura falla, la transacción rechaza (Prisma revierte todo)", async () => {
    const { repo, tx } = setup([]);
    tx.cartItem.create.mockImplementationOnce(() =>
      Promise.reject(new Error("FK rota")),
    );

    await expect(
      repo.addItemsAtomically("company-1", "user-1", [
        { productId: "p-1", quantity: 1, modifierIds: [] },
        { productId: "p-2", quantity: 1, modifierIds: [] },
      ]),
    ).rejects.toThrow("FK rota");
    expect(tx.cartItem.create).toHaveBeenCalledTimes(1);
  });
});

describe("CartRepository · carrito por usuario (T-35)", () => {
  it("getOrCreateForUser, getOrCreateViewForUser y findForUser usan la clave (empresa, usuario)", async () => {
    const row = {
      id: "cart-1",
      companyId: "company-1",
      userId: "user-2",
      couponId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };
    const upsert = jest.fn<
      Promise<typeof row>,
      [{ where: unknown; create: unknown }]
    >(() => Promise.resolve(row));
    const findUnique = jest.fn<Promise<null>, [{ where: unknown }]>(() =>
      Promise.resolve(null),
    );
    const prisma = { cart: { upsert, findUnique } };
    const repo = new CartRepository(prisma as unknown as PrismaService);
    const key = {
      companyId_userId: { companyId: "company-1", userId: "user-2" },
    };

    const cart = await repo.getOrCreateForUser("company-1", "user-2");
    await repo.getOrCreateViewForUser("company-1", "user-2");
    const missing = await repo.findForUser("company-1", "user-2");

    expect(cart.userId).toBe("user-2");
    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [args] of upsert.mock.calls) {
      expect(args.where).toEqual(key);
      expect(args.create).toEqual({ companyId: "company-1", userId: "user-2" });
    }
    expect(findUnique.mock.calls[0][0].where).toEqual(key);
    expect(missing).toBeNull();
  });
});
