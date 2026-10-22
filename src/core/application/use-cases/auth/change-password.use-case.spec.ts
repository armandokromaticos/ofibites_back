import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ChangePasswordUseCase,
  SAME_PASSWORD_MESSAGE,
  WRONG_CURRENT_PASSWORD_MESSAGE,
} from "./change-password.use-case";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";

describe("ChangePasswordUseCase", () => {
  const signInWithPassword = jest.fn();
  const updateUserById = jest.fn();
  const signOut = jest.fn();
  const getAdmin = jest.fn(() => ({
    auth: { admin: { updateUserById, signOut } },
  }));
  const ephemeralSignOut = jest.fn();
  const createEphemeralClient = jest.fn(() => ({
    auth: { signInWithPassword, signOut: ephemeralSignOut },
  }));
  const supabaseService = {
    getAdmin,
    createEphemeralClient,
  } as unknown as SupabaseService;

  const userUpdate = jest.fn();
  const userRepository = { update: userUpdate } as unknown as IUserRepository;

  const useCase = new ChangePasswordUseCase(userRepository, supabaseService);
  const actor = { id: "user-1", authId: "auth-1", email: "ana@empresa.com" };
  const token = "jwt-del-request";
  const dto = { currentPassword: "Actual#Clave1", newPassword: "Nueva#Clave2" };

  beforeEach(() => {
    signInWithPassword.mockReset();
    updateUserById.mockReset();
    signOut.mockReset();
    userUpdate.mockReset();
    createEphemeralClient.mockClear();
    ephemeralSignOut.mockReset();
    ephemeralSignOut.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "auth-1" }, session: {} },
      error: null,
    });
    updateUserById.mockResolvedValue({ data: {}, error: null });
    signOut.mockResolvedValue({ error: null });
    userUpdate.mockResolvedValue({});
  });

  it("cierra la sesión de verificación (scope local) aunque falle updateUserById", async () => {
    updateUserById.mockResolvedValue({
      data: {},
      error: { message: "boom", code: "unexpected_failure", status: 500 },
    });

    await expect(useCase.execute(actor, token, dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(ephemeralSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("responde 400 si la verificación devuelve otro usuario de Auth", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "auth-otro" }, session: {} },
      error: null,
    });

    const error = await useCase
      .execute(actor, token, dto)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      WRONG_CURRENT_PASSWORD_MESSAGE,
    );
    expect(ephemeralSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 503 si signInWithPassword lanza una excepción", async () => {
    signInWithPassword.mockRejectedValue(new Error("fetch failed"));

    await expect(useCase.execute(actor, token, dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 204 y cierra las otras sesiones aunque falle el marcado de passwordChangedAt", async () => {
    userUpdate.mockRejectedValue(new Error("db caída"));

    await expect(useCase.execute(actor, token, dto)).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith(token, "others");
  });

  it("cambia la contraseña, marca passwordChangedAt y cierra las otras sesiones", async () => {
    await useCase.execute(actor, token, dto);

    expect(ephemeralSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(createEphemeralClient).toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@empresa.com",
      password: "Actual#Clave1",
    });
    expect(updateUserById).toHaveBeenCalledWith("auth-1", {
      password: "Nueva#Clave2",
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordChangedAt: expect.any(Date) as Date },
    });
    expect(signOut).toHaveBeenCalledWith(token, "others");
  });

  it("responde 400 (no 401) si la contraseña actual es incorrecta", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: "Invalid login credentials",
        code: "invalid_credentials",
        status: 400,
      },
    });

    const error = await useCase
      .execute(actor, token, dto)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      WRONG_CURRENT_PASSWORD_MESSAGE,
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("responde 400 si la nueva es igual a la actual, sin llamar a Supabase", async () => {
    const error = await useCase
      .execute(actor, token, {
        currentPassword: "Misma#Clave1",
        newPassword: "Misma#Clave1",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(SAME_PASSWORD_MESSAGE);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 400 si Supabase rechaza la nueva por same_password", async () => {
    updateUserById.mockResolvedValue({
      data: {},
      error: { message: "same", code: "same_password", status: 422 },
    });

    await expect(useCase.execute(actor, token, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userUpdate).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("responde 503 si Supabase no está disponible al verificar", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "upstream", code: "unexpected_failure", status: 502 },
    });

    await expect(useCase.execute(actor, token, dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("responde 429 si Supabase limita los intentos", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: "rate",
        code: "over_request_rate_limit",
        status: 429,
      },
    });

    const error = await useCase
      .execute(actor, token, dto)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it("no falla si no se pueden cerrar las otras sesiones", async () => {
    signOut.mockResolvedValue({ error: { message: "boom" } });

    await expect(useCase.execute(actor, token, dto)).resolves.toBeUndefined();
    expect(userUpdate).toHaveBeenCalled();
  });
});
