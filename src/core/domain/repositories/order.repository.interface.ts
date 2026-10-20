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
  /** Quién hizo el pedido (`Order.userId`). Filtro "Usuario" de T-28b. */
  userId?: string;
  branchId?: string;
  departmentId?: string;
  /** Rango de `deliveryDate` (ambos inclusive), como medianoche UTC de esa fecha. */
  deliveryDateFrom?: Date;
  deliveryDateTo?: Date;
  /** Busca por `orderNumber` (contiene, sin distinguir mayúsculas). */
  search?: string;
  /** Solo se pagina (y se cuenta `total`) si vienen definidos. */
  skip?: number;
  take?: number;
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
  /** `total` solo se calcula si `filters.skip`/`filters.take` vienen definidos. */
  findVisible(
    filters: OrderListFilters,
  ): Promise<{ data: OrderEntity[]; total?: number }>;
  updateStatus(id: string, status: OrderStatus): Promise<OrderEntity>;
}
