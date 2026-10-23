import { OrderVisibilityFilter } from "./order.repository.interface";

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export interface OrdersPerDayPoint {
  /** Fecha en hora de Caracas, formato "YYYY-MM-DD". */
  date: string;
  count: number;
}

export interface TopOrderSummary {
  id: string;
  total: number;
  status: string;
  createdAt: Date;
}

export interface ClientDashboardData {
  totalOrders: number;
  inProgressOrders: number;
  ordersPerDay: OrdersPerDayPoint[];
  topOrders: TopOrderSummary[];
  dinersServed: number;
  monthInvestment: number;
  monthInvestmentChangePercent: number | null;
  topProducts: RankedProduct[];
}

export interface BranchBreakdownRow {
  branchId: string | null;
  name: string;
  orders: number;
  dinersServed: number;
  investment: number;
  avgTicket: number;
  changePercent: number | null;
}

export interface BranchBreakdownTotals {
  orders: number;
  dinersServed: number;
  investment: number;
  avgTicket: number;
  changePercent: number | null;
}

export interface BranchBreakdownData {
  rows: BranchBreakdownRow[];
  totals: BranchBreakdownTotals;
}

export interface DepartmentBreakdownRow {
  departmentId: string | null;
  name: string;
  mainBranchName: string | null;
  orders: number;
  dinersServed: number;
  investment: number;
  percentOfTotal: number;
}

export interface DepartmentBreakdownTotals {
  orders: number;
  dinersServed: number;
  investment: number;
  percentOfTotal: number;
}

export interface DepartmentBreakdownData {
  rows: DepartmentBreakdownRow[];
  totals: DepartmentBreakdownTotals;
}

export interface UserBreakdownRow {
  userId: string;
  name: string;
  departmentName: string | null;
  branchName: string | null;
  orders: number;
  investment: number;
  /** ISO 8601. */
  lastOrderAt: string;
}

export interface UserBreakdownData {
  rows: UserBreakdownRow[];
}

export interface RankedProduct {
  productId: string;
  name: string;
  quantity: number;
}

export interface RankedCombo {
  comboId: string;
  name: string;
  quantity: number;
}

export interface RankedCompany {
  companyId: string;
  name: string;
  total: number;
}

export interface AdminDashboardData {
  ordersToday: number;
  inPreparation: number;
  inTransit: number;
  billingThisMonth: number;
  ordersPerDay: OrdersPerDayPoint[];
  topProducts: RankedProduct[];
  topCombos: RankedCombo[];
  top5Companies: RankedCompany[];
}

export interface DashboardMonthRange {
  monthStart: Date;
  monthEnd: Date;
}

export interface AdminDashboardRange extends DashboardMonthRange {
  dayStart: Date;
  dayEnd: Date;
}

/**
 * Mes a consultar + el mes anterior, para los KPIs de "Indicadores" (T-32a)
 * que se comparan contra el mes previo (`changePercent`).
 */
export interface DashboardMonthComparisonRange extends DashboardMonthRange {
  previousMonthStart: Date;
  previousMonthEnd: Date;
}

export interface IDashboardRepository {
  getClientDashboard(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthComparisonRange,
  ): Promise<ClientDashboardData>;

  getAdminDashboard(
    visibility: OrderVisibilityFilter,
    range: AdminDashboardRange,
  ): Promise<AdminDashboardData>;

  getBranchBreakdown(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthComparisonRange,
  ): Promise<BranchBreakdownData>;

  getDepartmentBreakdown(
    visibility: OrderVisibilityFilter,
    range: DashboardMonthRange,
  ): Promise<DepartmentBreakdownData>;

  /** Alcance fijo a una sola empresa (dimensión restringida a admin/finanzas). */
  getUserBreakdown(
    companyId: string,
    range: DashboardMonthRange,
  ): Promise<UserBreakdownData>;
}
