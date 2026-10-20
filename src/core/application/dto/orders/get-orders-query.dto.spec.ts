import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GetOrdersQueryDto } from "./get-orders-query.dto";

const USER_ID = "11111111-1111-4111-8111-111111111111";

async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(GetOrdersQueryDto, query);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property).sort() };
}

describe("GetOrdersQueryDto", () => {
  it("acepta la query vacía", async () => {
    expect((await parse({})).fields).toEqual([]);
  });

  it("acepta statusGroup, fechas, ids y search válidos", async () => {
    const { dto, fields } = await parse({
      statusGroup: "scheduled",
      deliveryDateFrom: "2026-10-01",
      deliveryDateTo: "2026-10-31",
      branchId: USER_ID,
      departmentId: USER_ID,
      userId: USER_ID,
      search: "OF-2026-0007",
      skip: "0",
      take: "20",
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      statusGroup: "scheduled",
      deliveryDateFrom: "2026-10-01",
      deliveryDateTo: "2026-10-31",
      branchId: USER_ID,
      departmentId: USER_ID,
      userId: USER_ID,
      search: "OF-2026-0007",
      skip: 0,
      take: 20,
    });
  });

  it("trata search vacío como ausente", async () => {
    const { dto, fields } = await parse({ search: "   " });
    expect(fields).toEqual([]);
    expect(dto.search).toBeUndefined();
  });

  it.each([
    [{ statusGroup: "received_pending" }, "statusGroup"],
    [{ deliveryDateFrom: "2026/10/01" }, "deliveryDateFrom"],
    [{ deliveryDateFrom: "2026-02-30" }, "deliveryDateFrom"],
    [{ deliveryDateTo: "no-es-fecha" }, "deliveryDateTo"],
    [{ branchId: "no-es-uuid" }, "branchId"],
    [{ departmentId: "no-es-uuid" }, "departmentId"],
    [{ userId: "no-es-uuid" }, "userId"],
    [{ search: "a".repeat(51) }, "search"],
    [{ skip: "-1" }, "skip"],
    [{ take: "0" }, "take"],
    [{ take: "51" }, "take"],
  ])("rechaza %j", async (query, field) => {
    expect((await parse(query)).fields).toEqual([field]);
  });
});
