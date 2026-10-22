import { GetNotificationPreferencesUseCase } from "./get-notification-preferences.use-case";
import { NotificationPreferenceEntity } from "../../../domain/entities/notification-preference.entity";
import { NotificationPreferenceType } from "../../../domain/enums/notification-preference-type.enum";
import type { INotificationPreferenceRepository } from "../../../domain/repositories/notification-preference.repository.interface";

describe("GetNotificationPreferencesUseCase", () => {
  const findManyByUser = jest.fn();
  const repository = {
    findManyByUser,
  } as unknown as INotificationPreferenceRepository;

  const useCase = new GetNotificationPreferencesUseCase(repository);
  const userId = "user-1";

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("sin filas guardadas, sintetiza los 9 tipos en true/true", async () => {
    findManyByUser.mockResolvedValue([]);

    const result = await useCase.execute(userId);

    expect(result).toHaveLength(9);
    expect(result).toEqual(
      expect.arrayContaining(
        Object.values(NotificationPreferenceType).map((type) => ({
          type,
          emailEnabled: true,
          platformEnabled: true,
        })),
      ),
    );
  });

  it("usa la fila guardada cuando existe (tipo de novedades)", async () => {
    findManyByUser.mockResolvedValue([
      NotificationPreferenceEntity.fromPrisma({
        id: "pref-1",
        userId,
        type: NotificationPreferenceType.NEW_ASSORTMENT,
        emailEnabled: false,
        platformEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]);

    const result = await useCase.execute(userId);
    const newAssortment = result.find(
      (p) => p.type === NotificationPreferenceType.NEW_ASSORTMENT,
    );

    expect(newAssortment).toEqual({
      type: NotificationPreferenceType.NEW_ASSORTMENT,
      emailEnabled: false,
      platformEnabled: true,
    });
  });

  it("platformEnabled de un tipo de pedidos y facturas siempre es true, aunque la fila diga otra cosa", async () => {
    findManyByUser.mockResolvedValue([
      NotificationPreferenceEntity.fromPrisma({
        id: "pref-2",
        userId,
        type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
        emailEnabled: false,
        platformEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]);

    const result = await useCase.execute(userId);
    const orderStatus = result.find(
      (p) => p.type === NotificationPreferenceType.ORDER_STATUS_CHANGED,
    );

    expect(orderStatus).toEqual({
      type: NotificationPreferenceType.ORDER_STATUS_CHANGED,
      emailEnabled: false,
      platformEnabled: true,
    });
  });
});
