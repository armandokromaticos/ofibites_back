import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  CheckoutCartSnapshot,
  IOrderRepository,
  ORDER_FULL_INCLUDE,
  OrderListFilters,
} from "../../domain/repositories/order.repository.interface";
import { OrderEntity } from "../../domain/entities/order.entity";
import { OrderStatus } from "../../domain/enums/order-status.enum";
import { CartChangedException } from "../../domain/exceptions/cart-changed.exception";
import { formatOrderNumber } from "../../domain/services/order-number";
import { caracasYear } from "../../application/shared/caracas-time.util";
import { buildOrderVisibilityWhere } from "./order-visibility.where";

/**
 * Siguiente `orderNumber` del año de Caracas. `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` es atómico y deja bloqueada la fila del año hasta el
 * fin de la transacción: dos checkouts simultáneos se serializan y nunca
 * reciben el mismo número; si la transacción se revierte, el contador también
 * (sin huecos, a diferencia de una SEQUENCE).
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = caracasYear(now);
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO "order_number_counters" ("year", "last_value")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
    SET "last_value" = "order_number_counters"."last_value" + 1
    RETURNING "last_value"`;
  return formatOrderNumber(year, Number(rows[0].last_value));
}

/**
 * `DELETE` único y explícito de las líneas leídas en el checkout. Va en SQL
 * a propósito (y no con `deleteMany`, cuya traducción a SQL podría ser un
 * SELECT + DELETE por ids): en una sola sentencia Postgres bloquea cada fila y,
 * si otra transacción la cambió o la borró mientras esperaba, re-evalúa el
 * WHERE sobre la versión vigente (READ COMMITTED). Así un doble checkout o una
 * cantidad cambiada se traducen en un conteo menor, nunca en un pedido con
 * líneas que ya no están. Todo va parametrizado (`Prisma.sql` / `Prisma.join`).
 */
export function buildCheckoutCartDeleteQuery(
  cart: CheckoutCartSnapshot,
): Prisma.Sql {
  const pairs = Prisma.join(
    cart.items.map((item) => Prisma.sql`(${item.id}, ${item.quantity})`),
  );
  return Prisma.sql`DELETE FROM "cart_items" WHERE "cart_id" = ${cart.cartId} AND ("id", "quantity") IN (${pairs})`;
}

@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: OrderEntity): Promise<OrderEntity> {
    const order = await this.prisma.$transaction(
      async (tx) => {
        const orderNumber = await nextOrderNumber(tx);
        return tx.order.create({
          data: entity.toPrismaCreate(orderNumber),
          include: ORDER_FULL_INCLUDE,
        });
      },
      { timeout: 15000 },
    );
    return OrderEntity.fromPrisma(order);
  }

  async createFromCart(
    entity: OrderEntity,
    cart: CheckoutCartSnapshot,
  ): Promise<OrderEntity> {
    if (cart.items.length === 0) {
      throw new CartChangedException(cart.cartId);
    }
    const order = await this.prisma.$transaction(
      async (tx) => {
        // Primero se borran las líneas y el conteo decide si seguir; si no
        // cuadra se revierte todo (pedido, contador y borrado).
        const count = await tx.$executeRaw(buildCheckoutCartDeleteQuery(cart));
        if (count !== cart.items.length) {
          throw new CartChangedException(cart.cartId);
        }
        // El carrito "cambió" (se vació): lo reflejan los que lo estén mirando.
        await tx.cart.update({
          where: { id: cart.cartId },
          data: { updatedAt: new Date() },
        });

        const orderNumber = await nextOrderNumber(tx);
        return tx.order.create({
          data: entity.toPrismaCreate(orderNumber),
          include: ORDER_FULL_INCLUDE,
        });
        // Timeout default (5000ms) insuficiente para la latencia entre la
        // región del server y el pooler de Supabase: varios round-trips
        // secuenciales en esta transacción (P2028 visto en producción).
      },
      { timeout: 15000 },
    );
    return OrderEntity.fromPrisma(order);
  }

  async findUnique(
    args: Prisma.OrderFindUniqueArgs,
  ): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique(args);
    return order ? OrderEntity.fromPrisma(order) : null;
  }

  async findMany(
    args?: Prisma.OrderFindManyArgs,
  ): Promise<{ data: OrderEntity[]; total?: number }> {
    const rows = await this.prisma.order.findMany(args);
    const data = rows.map((row) => OrderEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.order.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.OrderUpdateArgs): Promise<OrderEntity> {
    const order = await this.prisma.order.update(args);
    return OrderEntity.fromPrisma(order);
  }

  async exists(args: Prisma.OrderCountArgs): Promise<boolean> {
    const count = await this.prisma.order.count(args);
    return count > 0;
  }

  async findVisible(
    filters: OrderListFilters,
  ): Promise<{ data: OrderEntity[]; total?: number }> {
    const where = buildOrderVisibilityWhere(filters.visibility);

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.branchId) {
      where.branchId = filters.branchId;
    }
    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters.deliveryDateFrom || filters.deliveryDateTo) {
      where.deliveryDate = {
        ...(filters.deliveryDateFrom ? { gte: filters.deliveryDateFrom } : {}),
        ...(filters.deliveryDateTo ? { lte: filters.deliveryDateTo } : {}),
      };
    }
    if (filters.search) {
      where.orderNumber = { contains: filters.search, mode: "insensitive" };
    }

    const hasPagination =
      typeof filters.skip === "number" || typeof filters.take === "number";

    const orders = await this.prisma.order.findMany({
      where,
      include: ORDER_FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
      ...(hasPagination ? { skip: filters.skip, take: filters.take } : {}),
    });
    const data = orders.map((order) => OrderEntity.fromPrisma(order));

    if (hasPagination) {
      const total = await this.prisma.order.count({ where });
      return { data, total };
    }
    return { data };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<OrderEntity> {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: ORDER_FULL_INCLUDE,
    });
    return OrderEntity.fromPrisma(order);
  }
}
