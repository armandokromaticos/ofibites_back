import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCompanyAddressDto } from "./create-company-address.dto";

async function errores(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateCompanyAddressDto, body);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

const base = {
  label: "Sede Caracas",
  line1: "Av. Principal",
  city: "Caracas",
  country: "Venezuela",
  contactName: "María Pérez",
  contactPhone: "+58 412-555-1234",
};

describe("CreateCompanyAddressDto", () => {
  it("acepta el body completo del Figma, sin isPrimary (default false en la entidad)", async () => {
    expect(await errores(base)).toEqual([]);
  });

  it("acepta isPrimary explícito", async () => {
    expect(await errores({ ...base, isPrimary: true })).toEqual([]);
  });

  it.each(["contactName", "contactPhone"])(
    "%s es requerido al crear",
    async (field) => {
      const rest: Record<string, unknown> = { ...base };
      delete rest[field];
      const mensajes = await errores(rest);
      expect(mensajes.length).toBeGreaterThan(0);
    },
  );

  it("contactName vacío (string vacía) falla (IsNotEmpty)", async () => {
    const mensajes = await errores({ ...base, contactName: "" });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("contactName admite como máximo 150 caracteres", async () => {
    const mensajes = await errores({ ...base, contactName: "a".repeat(151) });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("contactPhone admite como máximo 30 caracteres", async () => {
    const mensajes = await errores({
      ...base,
      contactPhone: "1".repeat(31),
    });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("isPrimary debe ser booleano", async () => {
    const mensajes = await errores({ ...base, isPrimary: "si" });
    expect(mensajes.length).toBeGreaterThan(0);
  });
});
