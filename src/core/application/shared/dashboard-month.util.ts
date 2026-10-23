import { caracasMonthRange } from "./caracas-time.util";

export interface DashboardMonthComparisonRange {
  monthStart: Date;
  monthEnd: Date;
  previousMonthStart: Date;
  previousMonthEnd: Date;
}

/**
 * `?month=AAAA-MM` ya validado por `DashboardMonthQueryDto` (regex). Sin mes,
 * usa "ahora". Ancla al mediodía UTC del día 1 de ese mes/año para que
 * `caracasMonthRange` (que desplaza por el offset de Caracas) no cruce al mes
 * vecino por un instante cerca de la medianoche.
 */
export function parseDashboardMonthAnchor(month?: string): Date {
  if (!month) {
    return new Date();
  }
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
}

/**
 * Rango del mes pedido (hora de Caracas) + el rango del mes anterior, para
 * los KPIs de "Indicadores" (T-32a) que se comparan contra el mes previo.
 */
export function resolveDashboardMonthRange(
  month?: string,
): DashboardMonthComparisonRange {
  const anchor = parseDashboardMonthAnchor(month);
  const { monthStart, monthEnd } = caracasMonthRange(anchor);
  // Un instante antes del inicio del mes cae siempre en el último día del mes
  // anterior (hora de Caracas), sin importar a qué hora cae monthStart en UTC.
  const previousAnchor = new Date(monthStart.getTime() - 1);
  const { monthStart: previousMonthStart, monthEnd: previousMonthEnd } =
    caracasMonthRange(previousAnchor);
  return { monthStart, monthEnd, previousMonthStart, previousMonthEnd };
}

/** "AAAA-MM" del mes resuelto (hora de Caracas), para nombres de archivo CSV. */
export function dashboardMonthKey(monthStart: Date): string {
  // monthStart es la medianoche Caracas del día 1 como instante UTC (04:00 UTC
  // ese mismo día 1, por el offset fijo de -4): año y mes UTC ya son correctos.
  const year = monthStart.getUTCFullYear();
  const monthNumber = monthStart.getUTCMonth() + 1;
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}
