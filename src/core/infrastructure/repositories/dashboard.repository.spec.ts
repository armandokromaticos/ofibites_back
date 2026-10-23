import { DashboardRepository } from "./dashboard.repository";
import type { PrismaService } from "../database/prisma/prisma.service";
import type { OrderVisibilityFilter } from "../../domain/repositories/order.repository.interface";

const ALL_VISIBILITY: OrderVisibilityFilter = { type: "all" };

function makePrisma() {
  return {
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    branch: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    companyMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

// T-32a: rango fijo para que los cálculos de "mes vs. mes anterior" sean
// deterministas en los tests.
const RANGE = {
  monthStart: new Date("2026-10-01T04:00:00.000Z"),
  monthEnd: new Date("2026-11-01T04:00:00.000Z"),
  previousMonthStart: new Date("2026-09-01T04:00:00.000Z"),
  previousMonthEnd: new Date("2026-10-01T04:00:00.000Z"),
};

describe("DashboardRepository.getClientDashboard (T-32a)", () => {
  it("calcula dinersServed, monthInvestment, el % vs. el mes anterior y topProducts", async () => {
    const prisma = makePrisma();
    prisma.order.count
      .mockResolvedValueOnce(10) // totalOrders
      .mockResolvedValueOnce(3); // inProgressOrders
    prisma.order.findMany
      .mockResolvedValueOnce([]) // monthOrders (ordersPerDay)
      .mockResolvedValueOnce([]); // topOrdersRaw
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { total: 1000 } }) // mes actual
      .mockResolvedValueOnce({ _sum: { total: 500 } }); // mes anterior
    prisma.orderItem.findMany.mockResolvedValueOnce([
      { quantity: 3, productSize: { servings: 4 } }, // 12 comensales
      { quantity: 2, productSize: null }, // servings ?? 1 = 2
    ]);
    prisma.orderItem.groupBy.mockResolvedValueOnce([
      { productId: "p1", _sum: { quantity: 5 } },
    ]);
    prisma.product.findMany.mockResolvedValueOnce([
      { id: "p1", nameEs: "Café" },
    ]);

    const repo = new DashboardRepository(prisma as unknown as PrismaService);
    const result = await repo.getClientDashboard(ALL_VISIBILITY, RANGE);

    expect(result.dinersServed).toBe(14);
    expect(result.monthInvestment).toBe(1000);
    expect(result.monthInvestmentChangePercent).toBe(100); // (1000-500)/500*100
    expect(result.topProducts).toEqual([
      { productId: "p1", name: "Café", quantity: 5 },
    ]);
  });

  it("monthInvestmentChangePercent es null si el mes anterior no facturó nada", async () => {
    const prisma = makePrisma();
    prisma.order.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { total: 300 } })
      .mockResolvedValueOnce({ _sum: { total: null } }); // sin pedidos facturables el mes anterior
    prisma.orderItem.findMany.mockResolvedValueOnce([]);
    prisma.orderItem.groupBy.mockResolvedValueOnce([]);

    const repo = new DashboardRepository(prisma as unknown as PrismaService);
    const result = await repo.getClientDashboard(ALL_VISIBILITY, RANGE);

    expect(result.monthInvestment).toBe(300);
    expect(result.monthInvestmentChangePercent).toBeNull();
    expect(result.dinersServed).toBe(0);
  });
});

describe("DashboardRepository.getBranchBreakdown (T-32a)", () => {
  it("agrupa por sede (incluida 'sin sede'), con avgTicket y changePercent vs. el mes anterior", async () => {
    const prisma = makePrisma();
    prisma.order.groupBy
      .mockResolvedValueOnce([
        { branchId: "b1", _count: { _all: 4 }, _sum: { total: 400 } },
        { branchId: null, _count: { _all: 1 }, _sum: { total: 50 } },
      ]) // mes actual
      .mockResolvedValueOnce([{ branchId: "b1", _sum: { total: 200 } }]); // mes anterior (sin fila para null → 0)
    prisma.orderItem.findMany.mockResolvedValueOnce([
      { quantity: 2, productSize: { servings: 3 }, order: { branchId: "b1" } },
      { quantity: 1, productSize: null, order: { branchId: null } },
    ]);
    prisma.branch.findMany.mockResolvedValueOnce([
      { id: "b1", name: "Sede Centro" },
    ]);

    const repo = new DashboardRepository(prisma as unknown as PrismaService);
    const result = await repo.getBranchBreakdown(ALL_VISIBILITY, RANGE);

    expect(result.rows).toEqual([
      {
        branchId: "b1",
        name: "Sede Centro",
        orders: 4,
        dinersServed: 6,
        investment: 400,
        avgTicket: 100,
        changePercent: 100, // (400-200)/200*100
      },
      {
        branchId: null,
        name: "Sin sede asignada",
        orders: 1,
        dinersServed: 1,
        investment: 50,
        avgTicket: 50,
        changePercent: null, // esa "sede" no facturó nada el mes anterior
      },
    ]);
    expect(result.totals).toEqual({
      orders: 5,
      dinersServed: 7,
      investment: 450,
      avgTicket: 90,
      changePercent: 125, // (450-200)/200*100
    });
  });
});

describe("DashboardRepository.getDepartmentBreakdown (T-32a)", () => {
  it("agrupa por departamento con mainBranchName (moda) y percentOfTotal", async () => {
    const prisma = makePrisma();
    prisma.order.groupBy
      .mockResolvedValueOnce([
        { departmentId: "d1", _count: { _all: 3 }, _sum: { total: 300 } },
        { departmentId: null, _count: { _all: 1 }, _sum: { total: 100 } },
      ]) // currentOrders
      .mockResolvedValueOnce([
        { departmentId: "d1", branchId: "b1", _count: { _all: 2 } },
        { departmentId: "d1", branchId: "b2", _count: { _all: 1 } },
        { departmentId: null, branchId: null, _count: { _all: 1 } },
      ]); // branchCounts
    prisma.orderItem.findMany.mockResolvedValueOnce([
      {
        quantity: 1,
        productSize: { servings: 2 },
        order: { departmentId: "d1" },
      },
      { quantity: 3, productSize: null, order: { departmentId: null } },
    ]);
    prisma.department.findMany.mockResolvedValueOnce([
      { id: "d1", name: "Ventas" },
    ]);
    prisma.branch.findMany.mockResolvedValueOnce([
      { id: "b1", name: "Sede Centro" },
    ]);

    const repo = new DashboardRepository(prisma as unknown as PrismaService);
    const result = await repo.getDepartmentBreakdown(ALL_VISIBILITY, RANGE);

    expect(result.rows).toEqual([
      {
        departmentId: "d1",
        name: "Ventas",
        mainBranchName: "Sede Centro",
        orders: 3,
        dinersServed: 2,
        investment: 300,
        percentOfTotal: 75,
      },
      {
        departmentId: null,
        name: "Sin departamento asignado",
        mainBranchName: null,
        orders: 1,
        dinersServed: 3,
        investment: 100,
        percentOfTotal: 25,
      },
    ]);
    expect(result.totals).toEqual({
      orders: 4,
      dinersServed: 5,
      investment: 400,
      percentOfTotal: 100,
    });
  });
});

describe("DashboardRepository.getUserBreakdown (T-32a)", () => {
  it("agrupa por usuario con nombre/sede/departamento del miembro y lastOrderAt", async () => {
    const prisma = makePrisma();
    prisma.order.groupBy.mockResolvedValueOnce([
      {
        userId: "u1",
        _count: { _all: 2 },
        _sum: { total: 150 },
        _max: { createdAt: new Date("2026-10-15T12:00:00.000Z") },
      },
      {
        userId: null, // pedido sin usuario asignado: no genera fila
        _count: { _all: 1 },
        _sum: { total: 20 },
        _max: { createdAt: new Date("2026-10-02T00:00:00.000Z") },
      },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Juan Pérez" },
    ]);
    prisma.companyMember.findMany.mockResolvedValueOnce([
      { userId: "u1", branchId: "b1", departmentId: "d1" },
    ]);
    prisma.branch.findMany.mockResolvedValueOnce([
      { id: "b1", name: "Sede Centro" },
    ]);
    prisma.department.findMany.mockResolvedValueOnce([
      { id: "d1", name: "Ventas" },
    ]);

    const repo = new DashboardRepository(prisma as unknown as PrismaService);
    const result = await repo.getUserBreakdown("company-1", {
      monthStart: RANGE.monthStart,
      monthEnd: RANGE.monthEnd,
    });

    expect(result.rows).toEqual([
      {
        userId: "u1",
        name: "Juan Pérez",
        departmentName: "Ventas",
        branchName: "Sede Centro",
        orders: 2,
        investment: 150,
        lastOrderAt: "2026-10-15T12:00:00.000Z",
      },
    ]);
  });
});
