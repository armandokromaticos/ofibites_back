import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GetCatalogQueryDto } from "./get-catalog-query.dto";

const TAG_A = "11111111-1111-4111-8111-111111111111";
const TAG_B = "22222222-2222-4222-8222-222222222222";

async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(GetCatalogQueryDto, query);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property).sort() };
}

describe("GetCatalogQueryDto", () => {
  it("acepta la query vacía", async () => {
    expect((await parse({})).fields).toEqual([]);
  });

  it("convierte tags separados por coma en una lista sin duplicados", async () => {
    const { dto, fields } = await parse({
      tags: ` ${TAG_A},${TAG_B},${TAG_A}`,
    });

    expect(fields).toEqual([]);
    expect(dto.tags).toEqual([TAG_A, TAG_B]);
  });

  it("trata search, section y tags vacíos como ausentes", async () => {
    const { dto, fields } = await parse({
      search: "  ",
      section: "",
      tags: "",
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      search: undefined,
      section: undefined,
      tags: undefined,
    });
  });

  it("convierte page y pageSize a número", async () => {
    const { dto, fields } = await parse({ page: "2", pageSize: "48" });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ page: 2, pageSize: 48 });
  });

  it.each([
    [{ search: "a" }, "search"],
    [{ pageSize: "49" }, "pageSize"],
    [{ page: "0" }, "page"],
    [{ filter: "popular" }, "filter"],
    [{ tags: "no-es-uuid" }, "tags"],
    [{ section: "Coffee Break" }, "section"],
    [{ lang: "fr" }, "lang"],
  ])("rechaza %j", async (query, field) => {
    expect((await parse(query)).fields).toEqual([field]);
  });
});
