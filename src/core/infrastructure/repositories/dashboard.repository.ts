import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  AdminDashboardData,
  AdminDashboardRange,
  BranchBreakdownData,
  ClientDashboardData,
  DashboardMonthComparisonRange,
  DashboardMonthRange,
  DepartmentBreakdownData,
  IDashboardRepository,
  OrdersPerDayPoint,
  UserBreakdownData,
} from "../../domain/repositories/dashboard.repository.interface";
import { OrderVisibilityFilter } from "../../domain/repositories/order.repository.interface";
import { OrderStatus } from "../../domain/enums/order-status.enum";
import {
  ORDER_BILLING_STATUSES,
  ORDER_IN_PROGRESS_STATUSES,
} from "../../domain/services/order-status-groups";
import { toCaracasDateKey } from "../../application/shared/caracas-time.util";
import { buildOrderVisibilityWhere } from "./order-visibility.where";

/** Fila mínima de `OrderItem` (sin combo) para sumar comensales por clave. */
interface DinerItemRow {
  quantity: number;
  productSize: { servings: number | null } | null;
}

@Injectable()
export class DashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getClientDashboard(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthComparisonRange,
  ): Promise<ClientDashboardData> {
    const scopeWhere = buildOrderVisibilityWhere(visibility);
    const monthWhere: Prisma.OrderWhereInput = {
      ...scopeWhere,
      createdAt: { gte: range.monthStart, lt: range.monthEnd },
    };
    const billingMonthWhere = this.billingWhere(
      scopeWhere,
      range.monthStart,
      range.monthEnd,
    );
    const previousBillingMonthWhere = this.billingWhere(
      scopeWhere,
      range.previousMonthStart,
      range.previousMonthEnd,
    );

    const [
      totalOrders,
      inProgressOrders,
      monthOrders,
      topOrdersRaw,
      monthInvestmentAgg,
      previousMonthInvestmentAgg,
      dinerItems,
      topProductsRaw,
    ] = await Promise.all([
      this.prisma.order.count({ where: scopeWhere }),
      this.prisma.order.count({
        where: {
          ...scopeWhere,
          status: { in: [...ORDER_IN_PROGRESS_STATUSES] },
        },
      }),
      this.prisma.order.findMany({
        where: monthWhere,
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: monthWhere,
        orderBy: { total: "desc" },
        take: 5,
        select: { id: true, total: true, status: true, createdAt: true },
      }),
      this.prisma.order.aggregate({
        where: billingMonthWhere,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: previousBillingMonthWhere,
        _sum: { total: true },
      }),
      this.prisma.orderItem.findMany({
        where: { comboId: null, order: billingMonthWhere },
        select: {
          quantity: true,
          productSize: { select: { servings: true } },
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { comboId: null, order: billingMonthWhere },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    const products = await this.prisma.product.findMany({
      where: { id: { in: topProductsRaw.map((row) => row.productId) } },
      select: { id: true, nameEs: true },
    });
    const productName = new Map(products.map((p) => [p.id, p.nameEs] as const));

    const monthInvestment = Number(monthInvestmentAgg._sum.total ?? 0);
    const previousMonthInvestment = Number(
      previousMonthInvestmentAgg._sum.total ?? 0,
    );

    return {
      totalOrders,
      inProgressOrders,
      ordersPerDay: this.bucketByDay(monthOrders),
      topOrders: topOrdersRaw.map((order) => ({
        id: order.id,
        total: Number(order.total),
        status: order.status,
        createdAt: order.createdAt,
      })),
      dinersServed: this.sumDiners(dinerItems),
      monthInvestment,
      monthInvestmentChangePercent: this.changePercent(
        monthInvestment,
        previousMonthInvestment,
      ),
      topProducts: topProductsRaw.map((row) => ({
        productId: row.productId,
        name: productName.get(row.productId) ?? "",
        quantity: row._sum.quantity ?? 0,
      })),
    };
  }

  async getBranchBreakdown(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthComparisonRange,
  ): Promise<BranchBreakdownData> {
    const scopeWhere = buildOrderVisibilityWhere(visibility);
    const currentWhere = this.billingWhere(
      scopeWhere,
      range.monthStart,
      range.monthEnd,
    );
    const previousWhere = this.billingWhere(
      scopeWhere,
      range.previousMonthStart,
      range.previousMonthEnd,
    );

    const [currentOrders, previousOrders, items] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["branchId"],
        where: currentWhere,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ["branchId"],
        where: previousWhere,
        _sum: { total: true },
      }),
      this.prisma.orderItem.findMany({
        where: { comboId: null, order: currentWhere },
        select: {
          quantity: true,
          productSize: { select: { servings: true } },
          order: { select: { branchId: true } },
        },
      }),
    ]);

    const dinersByBranch = this.groupDiners(
      items,
      (item) => item.order.branchId,
    );

    const branchIds = currentOrders
      .map((row) => row.branchId)
      .filter((id): id is string => id !== null);
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });
    const branchName = new Map(branches.map((b) => [b.id, b.name] as const));

    const previousInvestmentByBranch = new Map(
      previousOrders.map(
        (row) => [row.branchId, Number(row._sum.total ?? 0)] as const,
      ),
    );

    const rows = currentOrders.map((row) => {
      const orders = row._count._all;
      const investment = Number(row._sum.total ?? 0);
      const previousInvestment =
        previousInvestmentByBranch.get(row.branchId) ?? 0;
      return {
        branchId: row.branchId,
        name: row.branchId
          ? (branchName.get(row.branchId) ?? "")
          : "Sin sede asignada",
        orders,
        dinersServed: dinersByBranch.get(row.branchId) ?? 0,
        investment,
        avgTicket: orders > 0 ? this.round2(investment / orders) : 0,
        changePercent: this.changePercent(investment, previousInvestment),
      };
    });
    rows.sort((a, b) => b.investment - a.investment);

    const totalsOrders = rows.reduce((sum, row) => sum + row.orders, 0);
    const totalsInvestment = rows.reduce((sum, row) => sum + row.investment, 0);
    const totalsDiners = rows.reduce((sum, row) => sum + row.dinersServed, 0);
    const totalsPreviousInvestment = [
      ...previousInvestmentByBranch.values(),
    ].reduce((sum, value) => sum + value, 0);

    return {
      rows,
      totals: {
        orders: totalsOrders,
        dinersServed: totalsDiners,
        investment: totalsInvestment,
        avgTicket:
          totalsOrders > 0 ? this.round2(totalsInvestment / totalsOrders) : 0,
        changePercent: this.changePercent(
          totalsInvestment,
          totalsPreviousInvestment,
        ),
      },
    };
  }

  async getDepartmentBreakdown(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthRange,
  ): Promise<DepartmentBreakdownData> {
    const scopeWhere = buildOrderVisibilityWhere(visibility);
    const currentWhere = this.billingWhere(
      scopeWhere,
      range.monthStart,
      range.monthEnd,
    );

    const [currentOrders, branchCounts, items] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["departmentId"],
        where: currentWhere,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ["departmentId", "branchId"],
        where: currentWhere,
        _count: { _all: true },
      }),
      this.prisma.orderItem.findMany({
        where: { comboId: null, order: currentWhere },
        select: {
          quantity: true,
          productSize: { select: { servings: true } },
          order: { select: { departmentId: true } },
        },
      }),
    ]);

    const dinersByDepartment = this.groupDiners(
      items,
      (item) => item.order.departmentId,
    );

    const departmentIds = currentOrders
      .map((row) => row.departmentId)
      .filter((id): id is string => id !== null);
    const departments = await this.prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    });
    const departmentName = new Map(
      departments.map((d) => [d.id, d.name] as const),
    );

    // "Sede principal" = moda: la sede con más pedidos de ese departamento en
    // el período (se ignoran los pedidos sin sede al elegirla).
    const bestBranchByDepartment = new Map<
      string | null,
      { branchId: string; count: number }
    >();
    for (const row of branchCounts) {
      if (row.branchId === null) continue;
      const count = row._count._all;
      const existing = bestBranchByDepartment.get(row.departmentId);
      if (
        !existing ||
        count > existing.count ||
        (count === existing.count && row.branchId < existing.branchId)
      ) {
        bestBranchByDepartment.set(row.departmentId, {
          branchId: row.branchId,
          count,
        });
      }
    }
    const branches = await this.prisma.branch.findMany({
      where: {
        id: { in: [...bestBranchByDepartment.values()].map((v) => v.branchId) },
      },
      select: { id: true, name: true },
    });
    const branchName = new Map(branches.map((b) => [b.id, b.name] as const));

    const totalInvestment = currentOrders.reduce(
      (sum, row) => sum + Number(row._sum.total ?? 0),
      0,
    );

    const rows = currentOrders.map((row) => {
      const investment = Number(row._sum.total ?? 0);
      const bestBranch = bestBranchByDepartment.get(row.departmentId);
      return {
        departmentId: row.departmentId,
        name: row.departmentId
          ? (departmentName.get(row.departmentId) ?? "")
          : "Sin departamento asignado",
        mainBranchName: bestBranch
          ? (branchName.get(bestBranch.branchId) ?? null)
          : null,
        orders: row._count._all,
        dinersServed: dinersByDepartment.get(row.departmentId) ?? 0,
        investment,
        percentOfTotal:
          totalInvestment > 0
            ? this.round2((investment / totalInvestment) * 100)
            : 0,
      };
    });
    rows.sort((a, b) => b.investment - a.investment);

    return {
      rows,
      totals: {
        orders: rows.reduce((sum, row) => sum + row.orders, 0),
        dinersServed: rows.reduce((sum, row) => sum + row.dinersServed, 0),
        investment: totalInvestment,
        percentOfTotal: totalInvestment > 0 ? 100 : 0,
      },
    };
  }

  async getUserBreakdown(
    companyId: string,
    range: DashboardMonthRange,
  ): Promise<UserBreakdownData> {
    const where: Prisma.OrderWhereInput = {
      companyId,
      status: { in: [...ORDER_BILLING_STATUSES] },
      createdAt: { gte: range.monthStart, lt: range.monthEnd },
    };

    const grouped = await this.prisma.order.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });
    // Order.userId es nullable (pedidos sin usuario asignado); sin usuario no
    // hay fila "por usuario" que pintar.
    const rowsWithUser = grouped.filter((row) => row.userId !== null);
    const userIds = rowsWithUser.map((row) => row.userId as string);

    const [users, members] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      this.prisma.companyMember.findMany({
        where: { companyId, userId: { in: userIds } },
        select: { userId: true, branchId: true, departmentId: true },
      }),
    ]);
    const userName = new Map(users.map((u) => [u.id, u.name] as const));
    const memberByUser = new Map(members.map((m) => [m.userId, m] as const));

    const branchIds = members
      .map((m) => m.branchId)
      .filter((id): id is string => id !== null);
    const departmentIds = members
      .map((m) => m.departmentId)
      .filter((id): id is string => id !== null);
    const [branches, departments] = await Promise.all([
      this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      }),
    ]);
    const branchName = new Map(branches.map((b) => [b.id, b.name] as const));
    const departmentName = new Map(
      departments.map((d) => [d.id, d.name] as const),
    );

    const rows = rowsWithUser.map((row) => {
      const userId = row.userId as string;
      const member = memberByUser.get(userId);
      return {
        userId,
        name: userName.get(userId) ?? "",
        departmentName:
          member?.departmentId != null
            ? (departmentName.get(member.departmentId) ?? null)
            : null,
        branchName:
          member?.branchId != null
            ? (branchName.get(member.branchId) ?? null)
            : null,
        orders: row._count._all,
        investment: Number(row._sum.total ?? 0),
        lastOrderAt: (row._max.createdAt ?? range.monthStart).toISOString(),
      };
    });
    rows.sort((a, b) => b.investment - a.investment);

    return { rows };
  }

  async getAdminDashboard(
    visibility: OrderVisibilityFilter,
    range: AdminDashboardRange,
  ): Promise<AdminDashboardData> {
    const scopeWhere = buildOrderVisibilityWhere(visibility);
    // Rankings y facturación cuentan solo ventas reales (confirmadas en
    // adelante) del mes en curso.
    const billingMonthWhere: Prisma.OrderWhereInput = {
      ...scopeWhere,
      status: { in: [...ORDER_BILLING_STATUSES] },
      createdAt: { gte: range.monthStart, lt: range.monthEnd },
    };

    const [
      ordersToday,
      inPreparation,
      inTransit,
      billingAgg,
      monthOrders,
      topProductsRaw,
      topCombosRaw,
      topCompaniesRaw,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...scopeWhere,
          deliveryDate: { gte: range.dayStart, lt: range.dayEnd },
        },
      }),
      this.prisma.order.count({
        where: { ...scopeWhere, status: OrderStatus.IN_PREPARATION },
      }),
      this.prisma.order.count({
        where: { ...scopeWhere, status: OrderStatus.IN_TRANSIT },
      }),
      this.prisma.order.aggregate({
        where: billingMonthWhere,
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        where: {
          ...scopeWhere,
          createdAt: { gte: range.monthStart, lt: range.monthEnd },
        },
        select: { createdAt: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { comboId: null, order: billingMonthWhere },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      this.prisma.orderItem.groupBy({
        by: ["comboId"],
        where: { comboId: { not: null }, order: billingMonthWhere },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      this.prisma.order.groupBy({
        by: ["companyId"],
        where: billingMonthWhere,
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
    ]);

    const productIds = topProductsRaw.map((row) => row.productId);
    const comboIds = topCombosRaw
      .map((row) => row.comboId)
      .filter((id): id is string => id !== null);
    const companyIds = topCompaniesRaw.map((row) => row.companyId);

    // `{ in: [] }` no matchea nada; evitamos el branching para no romper la
    // inferencia de tipos y el costo extra es despreciable.
    const [products, combos, companies] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, nameEs: true },
      }),
      this.prisma.combo.findMany({
        where: { id: { in: comboIds } },
        select: { id: true, nameEs: true },
      }),
      this.prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, legalName: true },
      }),
    ]);

    const productName = new Map(products.map((p) => [p.id, p.nameEs] as const));
    const comboName = new Map(combos.map((c) => [c.id, c.nameEs] as const));
    const companyName = new Map(
      companies.map((c) => [c.id, c.legalName] as const),
    );

    return {
      ordersToday,
      inPreparation,
      inTransit,
      billingThisMonth: Number(billingAgg._sum.total ?? 0),
      ordersPerDay: this.bucketByDay(monthOrders),
      topProducts: topProductsRaw.map((row) => ({
        productId: row.productId,
        name: productName.get(row.productId) ?? "",
        quantity: row._sum.quantity ?? 0,
      })),
      topCombos: topCombosRaw.map((row) => ({
        comboId: row.comboId as string,
        name: comboName.get(row.comboId as string) ?? "",
        quantity: row._sum.quantity ?? 0,
      })),
      top5Companies: topCompaniesRaw.map((row) => ({
        companyId: row.companyId,
        name: companyName.get(row.companyId) ?? "",
        total: Number(row._sum.total ?? 0),
      })),
    };
  }

  private bucketByDay(rows: { createdAt: Date }[]): OrdersPerDayPoint[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = toCaracasDateKey(row.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // T-32a ("Indicadores" de Mi perfil): helpers compartidos por los KPIs del
  // cliente y los 3 desgloses. Mismo criterio que `billingThisMonth`/
  // `topProducts` del admin: solo estados facturables (ORDER_BILLING_STATUSES)
  // del rango dado, para que inversión, comensales y "pedidos" del desglose
  // sean la misma población (avgTicket = investment/orders queda coherente).
  private billingWhere(
    scopeWhere: Prisma.OrderWhereInput,
    monthStart: Date,
    monthEnd: Date,
  ): Prisma.OrderWhereInput {
    return {
      ...scopeWhere,
      status: { in: [...ORDER_BILLING_STATUSES] },
      createdAt: { gte: monthStart, lt: monthEnd },
    };
  }

  /** Comensales = sum(quantity * (servings ?? 1)) de ítems sin combo. */
  private sumDiners(items: DinerItemRow[]): number {
    return items.reduce(
      (sum, item) => sum + item.quantity * (item.productSize?.servings ?? 1),
      0,
    );
  }

  /** Igual que `sumDiners`, pero agrupado por una clave (sede/departamento). */
  private groupDiners<T extends DinerItemRow>(
    items: T[],
    keyFn: (item: T) => string | null,
  ): Map<string | null, number> {
    const map = new Map<string | null, number>();
    for (const item of items) {
      const key = keyFn(item);
      const servings = item.productSize?.servings ?? 1;
      map.set(key, (map.get(key) ?? 0) + item.quantity * servings);
    }
    return map;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * % de variación de `current` vs `previous`. `null` si `previous` es 0 (no
   * hay con qué comparar, evita dividir entre cero).
   */
  private changePercent(current: number, previous: number): number | null {
    if (previous === 0) {
      return null;
    }
    return this.round2(((current - previous) / previous) * 100);
  }
}
