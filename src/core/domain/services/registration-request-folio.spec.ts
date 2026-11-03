import { formatRegistrationRequestFolio } from "./registration-request-folio";

describe("formatRegistrationRequestFolio", () => {
  it("rellena a 4 dígitos", () => {
    expect(formatRegistrationRequestFolio(2026, 1)).toBe("SOL-2026-0001");
    expect(formatRegistrationRequestFolio(2026, 412)).toBe("SOL-2026-0412");
    expect(formatRegistrationRequestFolio(2026, 9999)).toBe("SOL-2026-9999");
  });

  it("pasado 9999 el número crece sin truncar", () => {
    expect(formatRegistrationRequestFolio(2026, 10000)).toBe("SOL-2026-10000");
  });

  it.each([0, -1, 1.5])("rechaza números inválidos (%p)", (n) => {
    expect(() => formatRegistrationRequestFolio(2026, n)).toThrow();
  });
});
