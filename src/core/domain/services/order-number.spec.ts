import { formatOrderNumber } from "./order-number";
import { caracasYear } from "../../application/shared/caracas-time.util";

describe("formatOrderNumber", () => {
  it("rellena a 4 dígitos", () => {
    expect(formatOrderNumber(2026, 1)).toBe("OF-2026-0001");
    expect(formatOrderNumber(2026, 42)).toBe("OF-2026-0042");
    expect(formatOrderNumber(2026, 9999)).toBe("OF-2026-9999");
  });

  it("pasado 9999 el número crece sin truncar", () => {
    expect(formatOrderNumber(2026, 10000)).toBe("OF-2026-10000");
  });

  it.each([0, -1, 1.5])("rechaza secuenciales inválidos (%p)", (seq) => {
    expect(() => formatOrderNumber(2026, seq)).toThrow();
  });
});

describe("caracasYear (año del número)", () => {
  it("el 1 de enero 03:59 UTC aún es 31 de diciembre en Caracas", () => {
    expect(caracasYear(new Date("2027-01-01T03:59:59.000Z"))).toBe(2026);
  });

  it("el 1 de enero 04:00 UTC ya es el año nuevo en Caracas", () => {
    expect(caracasYear(new Date("2027-01-01T04:00:00.000Z"))).toBe(2027);
  });
});
