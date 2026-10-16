import { caracasDayStartDaysAgo } from "./caracas-time.util";

describe("caracasDayStartDaysAgo", () => {
  it("antes de la medianoche de Caracas cuenta desde el día anterior", () => {
    // 2026-10-15T03:59Z = 2026-10-14 23:59 en Caracas.
    expect(
      caracasDayStartDaysAgo(30, new Date("2026-10-15T03:59:00.000Z")),
    ).toEqual(new Date("2026-09-14T04:00:00.000Z"));
  });

  it("desde la medianoche de Caracas cuenta desde ese mismo día", () => {
    // 2026-10-15T04:00Z = 2026-10-15 00:00 en Caracas.
    expect(
      caracasDayStartDaysAgo(30, new Date("2026-10-15T04:00:00.000Z")),
    ).toEqual(new Date("2026-09-15T04:00:00.000Z"));
  });

  it("con days = 0 devuelve la medianoche de hoy en Caracas", () => {
    expect(
      caracasDayStartDaysAgo(0, new Date("2026-10-15T16:00:00.000Z")),
    ).toEqual(new Date("2026-10-15T04:00:00.000Z"));
  });
});
