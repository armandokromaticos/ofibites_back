import { buildCsv, csvEscapeValue } from "./csv-builder.util";

describe("csv-builder.util (T-32a)", () => {
  it("csvEscapeValue envuelve en comillas si hay coma, comilla o salto de línea", () => {
    expect(csvEscapeValue("Sede Centro")).toBe("Sede Centro");
    expect(csvEscapeValue("Centro, Norte")).toBe('"Centro, Norte"');
    expect(csvEscapeValue('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(csvEscapeValue("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(csvEscapeValue(null)).toBe("");
    expect(csvEscapeValue(undefined)).toBe("");
    expect(csvEscapeValue(12.5)).toBe("12.5");
  });

  it("buildCsv une columnas con comas y filas con \\r\\n, escapando lo necesario", () => {
    const csv = buildCsv([
      ["Sede", "Pedidos", "Inversión"],
      ["Centro, Norte", 4, 400],
      ['Sede "VIP"', 1, 50],
    ]);
    expect(csv).toBe(
      'Sede,Pedidos,Inversión\r\n"Centro, Norte",4,400\r\n"Sede ""VIP""",1,50',
    );
  });
});
