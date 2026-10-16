import { Prisma } from "@prisma/client";
import { OrderEntity } from "../entities/order.entity";
import { OrderStatus } from "../enums/order-status.enum";

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");

export const ORDER_FULL_INCLUDE = {
  items: { include: { modifiers: true } },
} as const satisfies Prisma.OrderInclude;

export type OrderVisibilityFilter =
  | { type: "all" }
  | { type: "byCompany"; companyId: string }
  | { type: "byCompanies"; companyIds: string[] }
  | { type: "byUserOrCompanies"; userId: string; companyIds: string[] };

export interface OrderListFilters {
  visibility: OrderVisibilityFilter;
  statuses?: OrderStatus[];
}

/** Líneas del carrito tal como se leyeron y tarificaron en el checkout. */
export interface CheckoutCartSnapshot {
  cartId: string;
  items: { id: string; quantity: number }[];
}

export interface IOrderRepository {
  /** Crea el pedido y le asigna `orderNumber` (OF-AAAA-NNNN) en una transacción. */
  create(entity: OrderEntity): Promise<OrderEntity>;
  /**
   * Checkout: en **una transacción** borra del carrito exactamente las líneas
   * del snapshot (mismo id y cantidad), asigna `orderNumber` y crea el pedido.
   * Si alguna línea ya no está igual lanza `CartChangedException` y no se
   * escribe nada.
   */
  createFromCart(
    entity: OrderEntity,
    cart: CheckoutCartSnapshot,
  ): Promise<OrderEntity>;
  findUnique(args: Prisma.OrderFindUniqueArgs): Promise<OrderEntity | null>;
  findMany(
    args?: Prisma.OrderFindManyArgs,
  ): Promise<{ data: OrderEntity[]; total?: number }>;
  update(args: Prisma.OrderUpdateArgs): Promise<OrderEntity>;
  exists(args: Prisma.OrderCountArgs): Promise<boolean>;

  // Helpers de dominio
  findVisible(filters: OrderListFilters): Promise<OrderEntity[]>;
  updateStatus(id: string, status: OrderStatus): Promise<OrderEntity>;
}
