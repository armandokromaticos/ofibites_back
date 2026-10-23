import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { DashboardMonthQueryDto } from "./dashboard-month-query.dto";

async function validateMonth(month?: string) {
  const dto = plainToInstance(DashboardMonthQueryDto, { month });
  return validate(dto);
}

describe("DashboardMonthQueryDto (T-32a)", () => {
  it("sin month: válido (mes actual)", async () => {
    const errors = await validateMonth(undefined);
    expect(errors).toHaveLength(0);
  });

  it("month válido (AAAA-MM): sin errores", async () => {
    const errors = await validateMonth("2026-10");
    expect(errors).toHaveLength(0);
  });

  it.each(["2026-13", "2026-00", "2026/10", "10-2026", "2026-1", "hola"])(
    "month mal formado (%s): 400",
    async (month) => {
      const errors = await validateMonth(month);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toEqual(
        expect.objectContaining({
          matches:
            "month debe tener el formato AAAA-MM con un mes entre 01 y 12",
        }),
      );
    },
  );

  it("'' o solo espacios cuenta como ausente (mes actual), no como error", async () => {
    expect(await validateMonth("")).toHaveLength(0);
    expect(await validateMonth("   ")).toHaveLength(0);
  });
});
