import {
  dashboardMonthKey,
  parseDashboardMonthAnchor,
  resolveDashboardMonthRange,
} from "./dashboard-month.util";

describe("dashboard-month.util (T-32a)", () => {
  it("parseDashboardMonthAnchor sin mes usa 'ahora'", () => {
    const before = Date.now();
    const anchor = parseDashboardMonthAnchor(undefined);
    const after = Date.now();
    expect(anchor.getTime()).toBeGreaterThanOrEqual(before);
    expect(anchor.getTime()).toBeLessThanOrEqual(after);
  });

  it("parseDashboardMonthAnchor ancla al mediodía UTC del día 1 del mes pedido", () => {
    const anchor = parseDashboardMonthAnchor("2026-10");
    expect(anchor.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("resolveDashboardMonthRange calcula el mes pedido y el anterior (hora de Caracas)", () => {
    const range = resolveDashboardMonthRange("2026-10");
    expect(range.monthStart.toISOString()).toBe("2026-10-01T04:00:00.000Z");
    expect(range.monthEnd.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(range.previousMonthStart.toISOString()).toBe(
      "2026-09-01T04:00:00.000Z",
    );
    expect(range.previousMonthEnd.toISOString()).toBe(
      "2026-10-01T04:00:00.000Z",
    );
  });

  it("resolveDashboardMonthRange cruza el año correctamente (enero → diciembre anterior)", () => {
    const range = resolveDashboardMonthRange("2026-01");
    expect(range.previousMonthStart.toISOString()).toBe(
      "2025-12-01T04:00:00.000Z",
    );
    expect(range.previousMonthEnd.toISOString()).toBe(
      "2026-01-01T04:00:00.000Z",
    );
  });

  it("dashboardMonthKey devuelve AAAA-MM del mes resuelto", () => {
    const range = resolveDashboardMonthRange("2026-10");
    expect(dashboardMonthKey(range.monthStart)).toBe("2026-10");
  });
});
