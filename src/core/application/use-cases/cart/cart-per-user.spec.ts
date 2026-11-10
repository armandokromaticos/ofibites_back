import { NotFoundException } from "@nestjs/common";
import { AddCartItemUseCase } from "./add-cart-item.use-case";
import { UpdateCartItemUseCase } from "./update-cart-item.use-case";
import { RemoveCartItemUseCase } from "./remove-cart-item.use-case";
import { ClearCartUseCase } from "./clear-cart.use-case";
import type {
  AddCartItemParams,
  ICartRepository,
} from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { LineItemPricingService } from "../../services/line-item-pricing.service";
import type { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import type { CartViewService } from "../../services/cart-view.service";
import { CartEntity, CartItemInfo } from "../../../domain/entities/cart.entity";

const COMPANY = "company-1";
const MARKETING = "user-marketing";
const RRHH = "user-rrhh";

interface StoredCart {
  id: string;
  companyId: string;
  userId: string;
  items: CartItemInfo[];
}

/**
 * Repositorio en memoria con la misma clave que el real (T-35): un carrito por
 * (empresa, usuario). Basta para comprobar que los use cases nunca leen ni
 * tocan el carrito de otro usuario de la misma empresa.
 */
class InMemoryCartRepository {
  private readonly carts = new Map<string, StoredCart>();
  private nextItem = 0;

  private ensure(companyId: string, userId: string): StoredCart {
    const key = `${companyId}:${userId}`;
    let cart = this.carts.get(key);
    if (!cart) {
      cart = { id: `cart-${key}`, companyId, userId, items: [] };
      this.carts.set(key, cart);
    }
    return cart;
  }

  private byId(cartId: string): StoredCart | undefined {
    return [...this.carts.values()].find((c) => c.id === cartId);
  }

  private findItem(itemId: string): CartItemInfo | undefined {
    for (const cart of this.carts.values()) {
      const item = cart.items.find((i) => i.id === itemId);
      if (item) return item;
    }
    return undefined;
  }

  getOrCreateForUser(companyId: string, userId: string): Promise<CartEntity> {
    const cart = this.ensure(companyId, userId);
    return Promise.resolve(
      new CartEntity({
        ...cart,
        items: cart.items.map((i) => ({ ...i })),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  addItem(cartId: string, params: AddCartItemParams): Promise<void> {
    this.byId(cartId)?.items.push({
      id: `item-${++this.nextItem}`,
      productId: params.productId,
      productSizeId: params.productSizeId ?? null,
      comboId: params.comboId ?? null,
      quantity: params.quantity,
      addedById: params.addedById ?? null,
      modifierIds: params.modifierIds,
    });
    return Promise.resolve();
  }

  incrementItemQuantity(itemId: string, delta: number): Promise<void> {
    const item = this.findItem(itemId);
    if (item) item.quantity += delta;
    return Promise.resolve();
  }

  updateItemQuantity(itemId: string, quantity: number): Promise<void> {
    const item = this.findItem(itemId);
    if (item) item.quantity = quantity;
    return Promise.resolve();
  }

  removeItem(itemId: string): Promise<void> {
    for (const cart of this.carts.values()) {
      cart.items = cart.items.filter((i) => i.id !== itemId);
    }
    return Promise.resolve();
  }

  clear(cartId: string): Promise<void> {
    const cart = this.byId(cartId);
    if (cart) cart.items = [];
    return Promise.resolve();
  }

  itemsOf(userId: string): CartItemInfo[] {
    return this.ensure(COMPANY, userId).items;
  }
}

function setup() {
  const repo = new InMemoryCartRepository();
  const cartRepository = repo as unknown as ICartRepository;
  const companyRepository = {
    findUnique: jest.fn(() => Promise.resolve({ isActive: true })),
  } as unknown as ICompanyRepository;
  const pricing = {
    priceLineItem: jest.fn(() => Promise.resolve({})),
  } as unknown as LineItemPricingService;
  const availability = {
    assertAvailable: jest.fn(() => Promise.resolve()),
  } as unknown as LineItemAvailabilityService;
  const build = jest.fn(() => Promise.resolve({}));
  const cartView = { build } as unknown as CartViewService;

  return {
    repo,
    build,
    add: new AddCartItemUseCase(
      cartRepository,
      companyRepository,
      pricing,
      availability,
      cartView,
    ),
    update: new UpdateCartItemUseCase(
      cartRepository,
      companyRepository,
      cartView,
    ),
    remove: new RemoveCartItemUseCase(cartRepository, cartView),
    clear: new ClearCartUseCase(cartRepository, cartView),
  };
}

describe("Carrito por usuario dentro de la empresa (T-35)", () => {
  it("dos usuarios de la misma empresa tienen carritos independientes", async () => {
    const { repo, add, build } = setup();

    await add.execute(COMPANY, MARKETING, { productId: "p-1", quantity: 2 });
    await add.execute(COMPANY, RRHH, { productId: "p-1", quantity: 5 });
    await add.execute(COMPANY, RRHH, { productId: "p-2", quantity: 1 });

    // La misma línea no se suma entre usuarios: cada uno tiene la suya.
    expect(repo.itemsOf(MARKETING)).toEqual([
      expect.objectContaining({
        productId: "p-1",
        quantity: 2,
        addedById: MARKETING,
      }),
    ]);
    expect(repo.itemsOf(RRHH)).toEqual([
      expect.objectContaining({ productId: "p-1", quantity: 5 }),
      expect.objectContaining({ productId: "p-2", quantity: 1 }),
    ]);
    // La vista se arma con el carrito de quien hace la petición.
    expect(build).toHaveBeenLastCalledWith(COMPANY, RRHH, expect.anything());
  });

  it("no se puede cambiar ni quitar una línea del carrito de otro usuario (404)", async () => {
    const { repo, add, update, remove } = setup();
    await add.execute(COMPANY, MARKETING, { productId: "p-1", quantity: 2 });
    const [ajena] = repo.itemsOf(MARKETING);

    await expect(
      update.execute(COMPANY, RRHH, ajena.id, { quantity: 9 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      remove.execute(COMPANY, RRHH, ajena.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.itemsOf(MARKETING)).toEqual([
      expect.objectContaining({ id: ajena.id, quantity: 2 }),
    ]);
  });

  it("vaciar el carrito solo vacía el del usuario que lo pide", async () => {
    const { repo, add, clear } = setup();
    await add.execute(COMPANY, MARKETING, { productId: "p-1", quantity: 2 });
    await add.execute(COMPANY, RRHH, { productId: "p-2", quantity: 1 });

    await clear.execute(COMPANY, RRHH);

    expect(repo.itemsOf(RRHH)).toEqual([]);
    expect(repo.itemsOf(MARKETING)).toHaveLength(1);
  });
});
