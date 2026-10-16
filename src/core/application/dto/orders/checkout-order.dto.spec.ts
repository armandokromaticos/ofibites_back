import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CheckoutOrderDto } from "./checkout-order.dto";

const VALID = {
  deliveryAddressId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  deliveryDate: "2026-10-20",
  deliveryTime: "10:30",
  receiverName: "María Pérez",
  receiverPhone: "+58 412-555-1234",
};

/** Igual que el ValidationPipe global (whitelist + transform). */
async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(CheckoutOrderDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe("CheckoutOrderDto", () => {
  it("el body mínimo es válido", async () => {
    expect((await check(VALID)).fields).toEqual([]);
  });

  it("2026-02-30 no es una fecha real → error en deliveryDate", async () => {
    const { fields } = await check({ ...VALID, deliveryDate: "2026-02-30" });
    expect(fields).toEqual(["deliveryDate"]);
  });

  it("2028-02-29 (bisiesto) es válido", async () => {
    expect(
      (await check({ ...VALID, deliveryDate: "2028-02-29" })).fields,
    ).toEqual([]);
  });

  it.each(["2026-10-20T10:00:00Z", "20-10-2026", "2026-1-5"])(
    "deliveryDate con otro formato (%s) → error",
    async (deliveryDate) => {
      expect((await check({ ...VALID, deliveryDate })).fields).toEqual([
        "deliveryDate",
      ]);
    },
  );

  it.each([
    ["menos de 7 dígitos", "+58 12-34"],
    ["letras", "0412-ABC-1234"],
    ["salto de línea", "0412\n5551234"],
    ["tabulador", "0412\t5551234"],
    ["más de 20 caracteres", "+58 412 555 1234 5678 9"],
  ])("receiverPhone con %s → error", async (_label, receiverPhone) => {
    expect((await check({ ...VALID, receiverPhone })).fields).toEqual([
      "receiverPhone",
    ]);
  });

  it("receiverPhone y receiverName se recortan", async () => {
    const { dto, fields } = await check({
      ...VALID,
      receiverName: "  Ana  ",
      receiverPhone: " 04125551234 ",
    });
    expect(fields).toEqual([]);
    expect(dto.receiverName).toBe("Ana");
    expect(dto.receiverPhone).toBe("04125551234");
  });

  it('opcionales con "" o solo espacios → undefined', async () => {
    const { dto, fields } = await check({
      ...VALID,
      addressDetail: "",
      addressReference: "   ",
      notes: "",
    });
    expect(fields).toEqual([]);
    expect(dto.addressDetail).toBeUndefined();
    expect(dto.addressReference).toBeUndefined();
    expect(dto.notes).toBeUndefined();
  });

  it("deliveryTime fuera de HH:mm → error", async () => {
    expect((await check({ ...VALID, deliveryTime: "24:00" })).fields).toEqual([
      "deliveryTime",
    ]);
  });

  it("expectedTotal: número con hasta 2 decimales y no negativo", async () => {
    expect((await check({ ...VALID, expectedTotal: 135.5 })).fields).toEqual(
      [],
    );
    expect((await check({ ...VALID, expectedTotal: 1.234 })).fields).toEqual([
      "expectedTotal",
    ]);
    expect((await check({ ...VALID, expectedTotal: -1 })).fields).toEqual([
      "expectedTotal",
    ]);
    expect((await check({ ...VALID, expectedTotal: "135.5" })).fields).toEqual([
      "expectedTotal",
    ]);
  });
});
