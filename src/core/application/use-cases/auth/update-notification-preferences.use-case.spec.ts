import { BadRequestException } from "@nestjs/common";
import { UpdateNotificationPreferencesUseCase } from "./update-notification-preferences.use-case";
import type { GetNotificationPreferencesUseCase } from "./get-notification-preferences.use-case";
import type { INotificationPreferenceRepository } from "../../../domain/repositories/notification-preference.repository.interface";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";
import type { NotificationPreferenceResponseDto } from "../../dto/notification-preferences/notification-preference-response.dto";

describe("UpdateNotificationPreferencesUseCase", () => {
  const upsert = jest.fn();
  const getExecute = jest.fn();

  const repository = {
    upsert,
  } as unknown as INotificationPreferenceRepository;
  const getNotificationPreferencesUseCase = {
    execute: getExecute,
  } as unknown as GetNotificationPreferencesUseCase;

  const useCase = new UpdateNotificationPreferencesUseCase(
    repository,
    getNotificationPreferencesUseCase,
  );
  const userId = "user-1";
  const fullList = [] as NotificationPreferenceResponseDto[];

  beforeEach(() => {
    jest.resetAllMocks();
    upsert.mockResolvedValue({});
    getExecute.mockResolvedValue(fullList);
  });

  it("responde 400 si intenta apagar platformEnabled en un tipo de pedidos y facturas, sin escribir nada", async () => {
    await expect(
      useCase.execute(userId, [
        {
          type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
          platformEnabled: false,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("responde 400 aunque el ítem inválido no sea el primero de la lista, sin escribir ninguno", async () => {
    await expect(
      useCase.execute(userId, [
        {
          type: NotificationPreferenceType.NEW_ASSORTMENT,
          emailEnabled: false,
        },
        {
          type: NotificationPreferenceType.INVOICE_GENERATED,
          platformEnabled: false,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("permite platformEnabled true explícito en un tipo de pedidos y facturas", async () => {
    await useCase.execute(userId, [
      {
        type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
        platformEnabled: true,
      },
    ]);

    expect(upsert).toHaveBeenCalledWith({
      userId,
      type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
      emailEnabled: undefined,
      platformEnabled: true,
    });
  });

  it("upsert por cada ítem (tipo de novedades, crea o actualiza) y devuelve la lista completa", async () => {
    const result = await useCase.execute(userId, [
      {
        type: NotificationPreferenceType.NEW_ASSORTMENT,
        emailEnabled: false,
      },
      {
        type: NotificationPreferenceType.TERMS_CHANGES,
        platformEnabled: false,
      },
    ]);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      userId,
      type: NotificationPreferenceType.NEW_ASSORTMENT,
      emailEnabled: false,
      platformEnabled: undefined,
    });
    expect(upsert).toHaveBeenCalledWith({
      userId,
      type: NotificationPreferenceType.TERMS_CHANGES,
      emailEnabled: undefined,
      platformEnabled: false,
    });
    expect(getExecute).toHaveBeenCalledWith(userId);
    expect(result).toBe(fullList);
  });
});
