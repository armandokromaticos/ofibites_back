import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { ResetPasswordUseCase } from "./reset-password.use-case";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";

const nowSeconds = () => Math.floor(Date.now() / 1000);
const claimsWithAmr = (amr: unknown, iat = nowSeconds()) => ({
  data: { claims: { amr, iat }, header: {}, signature: new Uint8Array() },
  error: null,
});

describe("ResetPasswordUseCase", () => {
  const getUser = jest.fn();
  const getClaims = jest.fn();
  const updateUserById = jest.fn();
  const signOut = jest.fn();
  const supabaseService = {
    getAdmin: () => ({
      auth: { getUser, getClaims, admin: { updateUserById, signOut } },
    }),
  } as unknown as SupabaseService;

  const useCase = new ResetPasswordUseCase(supabaseService);
  const dto = { accessToken: "token-recuperacion", password: "Nueva#Clave1" };

  beforeEach(() => {
    getUser.mockReset();
    getClaims.mockReset();
    updateUserById.mockReset();
    signOut.mockReset();
    getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    getClaims.mockResolvedValue(
      claimsWithAmr([{ method: "recovery", timestamp: nowSeconds() - 60 }]),
    );
    updateUserById.mockResolvedValue({ data: {}, error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("cambia la contraseña y cierra todas las sesiones", async () => {
    await useCase.execute(dto);

    expect(getUser).toHaveBeenCalledWith("token-recuperacion");
    expect(getClaims).toHaveBeenCalledWith("token-recuperacion");
    expect(updateUserById).toHaveBeenCalledWith("auth-1", {
      password: "Nueva#Clave1",
    });
    expect(signOut).toHaveBeenCalledWith("token-recuperacion", "global");
  });

  it("acepta el amr en formato de strings usando el iat", async () => {
    getClaims.mockResolvedValue(claimsWithAmr(["recovery"]));

    await expect(useCase.execute(dto)).resolves.toBeUndefined();
  });

  it("acepta el amr otp que emite GoTrue al verificar el enlace del correo", async () => {
    getClaims.mockResolvedValue(
      claimsWithAmr([{ method: "otp", timestamp: nowSeconds() - 60 }]),
    );

    await expect(useCase.execute(dto)).resolves.toBeUndefined();
    expect(updateUserById).toHaveBeenCalled();
  });

  it("responde 401 si el token no es válido o venció", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 401 con un token de sesión normal (amr=password)", async () => {
    getClaims.mockResolvedValue(
      claimsWithAmr([{ method: "password", timestamp: nowSeconds() - 60 }]),
    );

    await expect(useCase.execute(dto)).rejects.toThrow(
      "El enlace de recuperación no es válido o venció. Solicita uno nuevo.",
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 401 si la recuperación tiene más de 1 h", async () => {
    getClaims.mockResolvedValue(
      claimsWithAmr([
        { method: "recovery", timestamp: nowSeconds() - 60 * 60 - 1 },
      ]),
    );

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 401 si no se pueden leer los claims", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "bad jwt" } });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 503 si getUser falla por red (AuthRetryableFetchError)", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("responde 503 si getUser devuelve un 5xx", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "upstream", status: 502 },
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("responde 503 si getClaims devuelve un 5xx", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: { message: "jwks caído", status: 503 },
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("responde 503 si getClaims lanza un error que no es AuthError", async () => {
    getClaims.mockRejectedValue(new TypeError("crypto no disponible"));

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("responde 401 si getClaims lanza un AuthError del token", async () => {
    getClaims.mockRejectedValue(new AuthError("firma inválida", 401));

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("responde 400 si la contraseña es igual a la anterior", async () => {
    updateUserById.mockResolvedValue({
      data: {},
      error: { message: "same", code: "same_password" },
    });

    const promise = useCase.execute(dto);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(
      "La nueva contraseña debe ser distinta de la anterior.",
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each(["weak_password", "validation_failed"])(
    "responde 400 ante %s",
    async (code) => {
      updateUserById.mockResolvedValue({
        data: {},
        error: { message: "x", code },
      });

      await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it("responde 503 ante otros errores de Supabase", async () => {
    updateUserById.mockResolvedValue({
      data: {},
      error: { message: "boom", code: "unexpected_failure" },
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("no falla si no se pueden cerrar las sesiones", async () => {
    signOut.mockRejectedValue(new Error("red caída"));

    await expect(useCase.execute(dto)).resolves.toBeUndefined();
  });
});
