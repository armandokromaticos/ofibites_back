import { Prisma } from "@prisma/client";
import { CartEntity } from "../entities/cart.entity";

export const CART_REPOSITORY = Symbol("CART_REPOSITORY");

/** Para las mutaciones: solo líneas y modificadores (buscar y deduplicar). */
export const CART_ITEMS_INCLUDE = {
  items: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { modifiers: true },
  },
} as const satisfies Prisma.CartInclude;

/**
 * Vista (`CartViewService`): carrito con lo necesario para mostrar cada línea (nombre, imagen, tamaño,
 * personas) y calcular `isAvailable` sin consultas extra por línea. Se cargan
 * también los inactivos: una línea vieja debe seguir mostrando su nombre.
 */
export const CART_FULL_INCLUDE = {
  items: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      modifiers: {
        include: {
          modifier: {
            select: {
              isActive: true,
              sizeRestricted: true,
              group: { select: { productId: true } },
              sizePrices: { select: { productSizeId: true } },
            },
          },
        },
      },
      product: {
        select: {
          nameEs: true,
          nameEn: true,
          image: true,
          isActive: true,
          sizes: { where: { isActive: true }, select: { id: true } },
        },
      },
      productSize: {
        select: {
          productId: true,
          nameEs: true,
          nameEn: true,
          servings: true,
          isActive: true,
        },
      },
      combo: {
        select: {
          nameEs: true,
          nameEn: true,
          image: true,
          isActive: true,
          items: { select: { productId: true } },
        },
      },
    },
  },
} as const satisfies Prisma.CartInclude;

export interface AddCartItemParams {
  productId: string;
  productSizeId?: string | null;
  comboId?: string | null;
  quantity: number;
  modifierIds: string[];
  addedById?: string | null;
}

export interface ICartRepository {
  // El carrito es único por empresa, por eso el acceso es por companyId en vez
  // del CRUD genérico. getOrCreate evita el race de creación vía upsert.
  // Ambos con CART_ITEMS_INCLUDE (sin datos de presentación).
  getOrCreateByCompanyId(companyId: string): Promise<CartEntity>;
  findByCompanyId(companyId: string): Promise<CartEntity | null>;
  /** Igual que getOrCreate pero con CART_FULL_INCLUDE: solo para la vista. */
  getOrCreateViewByCompanyId(companyId: string): Promise<CartEntity>;
  addItem(cartId: string, params: AddCartItemParams): Promise<void>;
  /**
   * Añade varias líneas en **una transacción**: si ya existe una idéntica
   * (producto + tamaño/combo + mismos modificadores) suma la cantidad; si no,
   * la crea. O se aplican todas o ninguna.
   */
  addItemsAtomically(
    companyId: string,
    lines: AddCartItemParams[],
  ): Promise<void>;
  updateItemQuantity(itemId: string, quantity: number): Promise<void>;
  // Incremento atómico (quantity = quantity + delta) para evitar lost updates
  // al sumar a una línea existente desde requests concurrentes.
  incrementItemQuantity(itemId: string, delta: number): Promise<void>;
  removeItem(itemId: string): Promise<void>;
  clear(cartId: string): Promise<void>;
}
