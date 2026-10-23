import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateNotificationPreferenceItemDto } from "./update-notification-preference-item.dto";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";

async function errores(item: Record<string, unknown>) {
  const dto = plainToInstance(UpdateNotificationPreferenceItemDto, item);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe("UpdateNotificationPreferenceItemDto", () => {
  it("acepta un tipo válido con los dos flags", async () => {
    const mensajes = await errores({
      type: NotificationPreferenceType.NEW_ASSORTMENT,
      emailEnabled: false,
      platformEnabled: true,
    });
    expect(mensajes).toEqual([]);
  });

  it("acepta un tipo válido sin flags (no cambia nada)", async () => {
    const mensajes = await errores({
      type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
    });
    expect(mensajes).toEqual([]);
  });

  it("type inválido (no es uno de los 9 códigos) → 400 en español", async () => {
    const mensajes = await errores({ type: "ALGO_RARO" });
    expect(mensajes).toContain(
      "type debe ser uno de los códigos válidos del catálogo de preferencias",
    );
  });

  it("sin type → 400", async () => {
    const mensajes = await errores({ emailEnabled: true });
    expect(mensajes.length).toBeGreaterThan(0);
  });

  it("emailEnabled no booleano → 400", async () => {
    const mensajes = await errores({
      type: NotificationPreferenceType.NEW_ASSORTMENT,
      emailEnabled: "si",
    });
    expect(mensajes).toContain("emailEnabled debe ser verdadero o falso");
  });
});
