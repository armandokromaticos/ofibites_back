import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateBannerDto } from "./create-banner.dto";
import { UpdateBannerDto } from "./update-banner.dto";

const base = {
  imageUrl: "https://cdn.ofibites.com/banners/b1.png",
  altText: "Banner de reuniones",
};

async function validarCreate(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateBannerDto, body);
  const errors = await validate(dto);
  return {
    dto,
    mensajes: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

async function validarUpdate(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateBannerDto, body);
  const errors = await validate(dto);
  return {
    dto,
    mensajes: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe("subtitle en CreateBannerDto / UpdateBannerDto", () => {
  it("create: es opcional", async () => {
    const { dto, mensajes } = await validarCreate({ ...base });
    expect(mensajes).toEqual([]);
    expect(dto.subtitle).toBeUndefined();
  });

  it("create: recorta espacios", async () => {
    const { dto, mensajes } = await validarCreate({
      ...base,
      subtitle: "  Ideal para reuniones de 4 a 15 personas  ",
    });
    expect(mensajes).toEqual([]);
    expect(dto.subtitle).toBe("Ideal para reuniones de 4 a 15 personas");
  });

  it("create: más de 160 caracteres falla", async () => {
    const { mensajes } = await validarCreate({
      ...base,
      subtitle: "a".repeat(161),
    });
    expect(mensajes).toContain("subtitle admite como máximo 160 caracteres");
  });

  it("create: 160 caracteres es válido", async () => {
    const { mensajes } = await validarCreate({
      ...base,
      subtitle: "a".repeat(160),
    });
    expect(mensajes).toEqual([]);
  });

  it("update: string vacío (o solo espacios) pasa a null", async () => {
    const { dto, mensajes } = await validarUpdate({ subtitle: "   " });
    expect(mensajes).toEqual([]);
    expect(dto.subtitle).toBeNull();
  });

  it("update: null se acepta para borrar", async () => {
    const { dto, mensajes } = await validarUpdate({ subtitle: null });
    expect(mensajes).toEqual([]);
    expect(dto.subtitle).toBeNull();
  });

  it("update: no texto falla", async () => {
    const { mensajes } = await validarUpdate({ subtitle: 123 });
    expect(mensajes).toContain("subtitle debe ser texto");
  });
});
