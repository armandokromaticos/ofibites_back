import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCompanyAddressDto } from "./update-company-address.dto";

async function errores(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCompanyAddressDto, body);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe("UpdateCompanyAddressDto", () => {
  it("contactName/contactPhone/isPrimary son opcionales al actualizar", async () => {
    expect(await errores({})).toEqual([]);
    expect(await errores({ label: "Otra sede" })).toEqual([]);
  });

  it("acepta contactName/contactPhone/isPrimary válidos", async () => {
    expect(
      await errores({
        contactName: "Juan Gómez",
        contactPhone: "0212-555-0000",
        isPrimary: true,
      }),
    ).toEqual([]);
  });

  it("contactName vacío (si viene) falla", async () => {
    const mensajes = await errores({ contactName: "" });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("contactName admite como máximo 150 caracteres", async () => {
    const mensajes = await errores({ contactName: "a".repeat(151) });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("contactPhone admite como máximo 30 caracteres", async () => {
    const mensajes = await errores({ contactPhone: "1".repeat(31) });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("isPrimary debe ser booleano", async () => {
    const mensajes = await errores({ isPrimary: "si" });
    expect(mensajes.length).toBeGreaterThan(0);
  });
});
