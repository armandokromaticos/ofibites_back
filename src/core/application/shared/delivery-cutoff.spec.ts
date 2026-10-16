import { deliveryCutoffError } from "./delivery-cutoff";

// Hoy en Caracas: 2026-10-16 (viernes). Caracas = UTC-4.
const at = (caracasTime: string) =>
  new Date(`2026-10-16T${caracasTime}:00.000-04:00`);

describe("deliveryCutoffError (corte 15:00 de Caracas del día anterior)", () => {
  it("hoy nunca vale → DELIVERY_CUTOFF", () => {
    expect(deliveryCutoffError("2026-10-16", at("08:00"))).toEqual({
      code: "DELIVERY_CUTOFF",
      message: "La fecha de entrega debe ser a partir de mañana",
    });
  });

  it("una fecha pasada → DELIVERY_CUTOFF", () => {
    expect(deliveryCutoffError("2026-10-01", at("08:00"))?.code).toBe(
      "DELIVERY_CUTOFF",
    );
  });

  it("mañana antes de las 15:00 vale", () => {
    expect(deliveryCutoffError("2026-10-17", at("14:59"))).toBeNull();
  });

  it("mañana a las 15:00 o después → DELIVERY_CUTOFF", () => {
    expect(deliveryCutoffError("2026-10-17", at("15:00"))).toEqual({
      code: "DELIVERY_CUTOFF",
      message:
        "Los pedidos para mañana se agendan hasta las 3:00 p.m. (hora de Caracas). Elige una fecha posterior",
    });
    expect(deliveryCutoffError("2026-10-17", at("23:30"))?.code).toBe(
      "DELIVERY_CUTOFF",
    );
  });

  it("pasado mañana vale aunque sean más de las 15:00", () => {
    expect(deliveryCutoffError("2026-10-18", at("15:00"))).toBeNull();
    expect(deliveryCutoffError("2026-10-18", at("23:59"))).toBeNull();
  });

  it("se entrega todos los días: sábado y domingo valen (feriados: T-27)", () => {
    // 2026-10-17 es sábado y 2026-10-18 domingo.
    expect(deliveryCutoffError("2026-10-17", at("09:00"))).toBeNull();
    expect(deliveryCutoffError("2026-10-18", at("09:00"))).toBeNull();
  });

  it("usa el día de Caracas, no el de UTC (23:30 Caracas = 03:30 UTC del día siguiente)", () => {
    const now = new Date("2026-10-17T03:30:00.000Z"); // 16-oct 23:30 Caracas
    expect(deliveryCutoffError("2026-10-17", now)?.code).toBe(
      "DELIVERY_CUTOFF",
    );
    expect(deliveryCutoffError("2026-10-18", now)).toBeNull();
  });

  it("cruza fin de mes y de año", () => {
    const now = new Date("2026-12-31T10:00:00.000-04:00");
    expect(deliveryCutoffError("2027-01-01", now)).toBeNull();
    expect(deliveryCutoffError("2026-12-31", now)?.code).toBe(
      "DELIVERY_CUTOFF",
    );
  });
});

describe("deliveryCutoffError (horizonte de 90 días)", () => {
  const now = new Date("2026-10-16T10:00:00.000-04:00");

  it("hoy + 90 vale", () => {
    expect(deliveryCutoffError("2027-01-14", now)).toBeNull();
  });

  it("hoy + 91 → DELIVERY_HORIZON", () => {
    expect(deliveryCutoffError("2027-01-15", now)).toEqual({
      code: "DELIVERY_HORIZON",
      message: "La fecha de entrega no puede ser más de 90 días después de hoy",
    });
  });
});
