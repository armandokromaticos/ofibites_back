import { OrderStatus } from "../enums/order-status.enum";

// Grupo visible para el cliente en "Pedidos realizados" (T-28). Mapeo
// confirmado por el usuario (ver gestion/DECISIONES.md 2026-10-20).
export enum OrderStatusGroup {
  RECEIVED = "received",
  SCHEDULED = "scheduled",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

const STATUS_TO_GROUP: Record<OrderStatus, OrderStatusGroup> = {
  [OrderStatus.CREATED]: OrderStatusGroup.RECEIVED,
  [OrderStatus.PENDING_APPROVAL]: OrderStatusGroup.RECEIVED,
  [OrderStatus.PENDING_CONFIRMATION]: OrderStatusGroup.RECEIVED,
  [OrderStatus.IN_ADJUSTMENT]: OrderStatusGroup.RECEIVED,
  [OrderStatus.CONFIRMED]: OrderStatusGroup.SCHEDULED,
  [OrderStatus.IN_PREPARATION]: OrderStatusGroup.SCHEDULED,
  [OrderStatus.IN_TRANSIT]: OrderStatusGroup.IN_TRANSIT,
  [OrderStatus.DELIVERED]: OrderStatusGroup.DELIVERED,
  [OrderStatus.REJECTED]: OrderStatusGroup.CANCELLED,
  [OrderStatus.CANCELLED]: OrderStatusGroup.CANCELLED,
};

/** Grupo visible del cliente para un `OrderStatus` (campo derivado, no de BD). */
export function getOrderStatusGroup(status: OrderStatus): OrderStatusGroup {
  return STATUS_TO_GROUP[status];
}

// Reverso del mapeo anterior: todos los OrderStatus de un grupo, para
// traducir el filtro `?statusGroup=` a un `status.in` de Prisma.
export const ORDER_STATUSES_BY_GROUP: Record<OrderStatusGroup, OrderStatus[]> =
  Object.values(OrderStatus).reduce(
    (acc, status) => {
      const group = STATUS_TO_GROUP[status];
      acc[group].push(status);
      return acc;
    },
    {
      [OrderStatusGroup.RECEIVED]: [],
      [OrderStatusGroup.SCHEDULED]: [],
      [OrderStatusGroup.IN_TRANSIT]: [],
      [OrderStatusGroup.DELIVERED]: [],
      [OrderStatusGroup.CANCELLED]: [],
    } as Record<OrderStatusGroup, OrderStatus[]>,
  );

// Estados terminales: el pedido ya no avanza.
const TERMINAL = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
]);

export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [...TERMINAL];

// "En curso": pedido vivo (cualquier estado no terminal). Se deriva del set de
// terminales para que un nuevo estado del enum entre aquí por default.
export const ORDER_IN_PROGRESS_STATUSES: readonly OrderStatus[] = Object.values(
  OrderStatus,
).filter((status) => !TERMINAL.has(status));

// Facturación: ingreso comprometido (pedido confirmado en adelante). Proxy del
// monto facturado hasta que exista el modelo Invoice (Fase E); cuando entre, se
// reemplaza esta lista por la fuente real en un solo lugar.
export const ORDER_BILLING_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
];
