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

    await repo.addItemsAtomically("company-1", [
      { productId: "p-1", quantity: 2, modifierIds: [] },
      { productId: "p-2", quantity: 1, modifierIds: ["m-1"], addedById: "u-1" },
      { productId: "p-2", quantity: 4, modifierIds: ["m-1"], addedById: "u-1" },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-1" } }),
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
      repo.addItemsAtomically("company-1", [
        { productId: "p-1", quantity: 1, modifierIds: [] },
        { productId: "p-2", quantity: 1, modifierIds: [] },
      ]),
    ).rejects.toThrow("FK rota");
    expect(tx.cartItem.create).toHaveBeenCalledTimes(1);
  });
});
