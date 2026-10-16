import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GetNotificationsQueryDto } from "./get-notifications-query.dto";
import { parseOptionalCompanyIdHeader } from "../../shared/company-id-header.util";
import { notificationIdPipe } from "../../../../modules/notifications/notification-id.pipe";

async function errores(query: Record<string, string>) {
  const dto = plainToInstance(GetNotificationsQueryDto, query);
  const errors = await validate(dto);
  return {
    dto,
    mensajes: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe("GetNotificationsQueryDto", () => {
  it("acepta la query del popover y convierte tipos", async () => {
    const { dto, mensajes } = await errores({
      unread: "true",
      skip: "0",
      take: "10",
    });
    expect(mensajes).toEqual([]);
    expect(dto).toMatchObject({ unread: true, skip: 0, take: 10 });
  });

  it("unread=false y sin parámetros son válidos", async () => {
    expect((await errores({ unread: "false" })).dto.unread).toBe(false);
    expect((await errores({})).mensajes).toEqual([]);
  });

  it.each([
    [{ unread: "foo" }, "unread debe ser true o false"],
    [{ take: "51" }, "take no puede ser mayor que 50"],
    [{ take: "0" }, "take debe ser al menos 1"],
    [{ take: "abc" }, "take debe ser un número entero"],
    [{ skip: "-1" }, "skip no puede ser negativo"],
  ])("%j → 400 '%s'", async (query, mensaje) => {
    const { mensajes } = await errores(query);
    expect(mensajes).toContain(mensaje);
  });
});

describe("parseOptionalCompanyIdHeader", () => {
  it("sin header o vacío → undefined", () => {
    expect(parseOptionalCompanyIdHeader(undefined)).toBeUndefined();
    expect(parseOptionalCompanyIdHeader("   ")).toBeUndefined();
  });

  it("UUID → recortado", () => {
    expect(
      parseOptionalCompanyIdHeader(" 0f8fad5b-d9cb-469f-a165-70867728950e "),
    ).toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("no UUID → 400 en español", () => {
    expect(() => parseOptionalCompanyIdHeader("empresa-1")).toThrow(
      new BadRequestException("X-Company-Id debe ser un UUID válido"),
    );
  });
});

describe("notificationIdPipe", () => {
  it("acepta un UUID", async () => {
    await expect(
      notificationIdPipe().transform("0f8fad5b-d9cb-469f-a165-70867728950e", {
        type: "param",
      }),
    ).resolves.toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("un id no UUID → 400 en español", async () => {
    await expect(
      notificationIdPipe().transform("n1", { type: "param" }),
    ).rejects.toThrow("El id de la notificación no es válido");
  });
});
