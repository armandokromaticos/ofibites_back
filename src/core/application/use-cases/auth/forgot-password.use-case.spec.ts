import { ForgotPasswordUseCase } from "./forgot-password.use-case";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";

/** Deja correr el envío en segundo plano (then/catch) antes de comprobar. */
const flushBackground = () => new Promise((resolve) => setImmediate(resolve));

describe("ForgotPasswordUseCase", () => {
  const exists = jest.fn();
  const resetPasswordForEmail = jest.fn();
  const userRepository = { exists } as unknown as IUserRepository;
  const supabaseService = {
    getAdmin: () => ({ auth: { resetPasswordForEmail } }),
  } as unknown as SupabaseService;

  let useCase: ForgotPasswordUseCase;
  const originalRedirect = process.env.SUPABASE_RECOVERY_REDIRECT_URL;

  beforeEach(() => {
    exists.mockReset();
    resetPasswordForEmail.mockReset();
    process.env.SUPABASE_RECOVERY_REDIRECT_URL =
      " http://localhost:3001/reset-password ";
    // Instancia nueva por test: el enfriamiento vive en memoria del use-case.
    useCase = new ForgotPasswordUseCase(userRepository, supabaseService);
  });

  afterEach(() => jest.useRealTimers());

  afterAll(() => {
    process.env.SUPABASE_RECOVERY_REDIRECT_URL = originalRedirect;
  });

  it("envía el correo con redirectTo cuando el usuario existe", async () => {
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await useCase.execute({ email: " Maria@Diageo.com " });
    await flushBackground();

    expect(exists).toHaveBeenCalledWith({
      where: {
        email: { equals: "maria@diageo.com", mode: "insensitive" },
        authId: { not: null },
        isActive: true,
      },
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("maria@diageo.com", {
      redirectTo: "http://localhost:3001/reset-password",
    });
  });

  it("no espera al envío: responde aunque Supabase no haya contestado", async () => {
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockReturnValue(new Promise(() => undefined));

    await expect(
      useCase.execute({ email: "maria@diageo.com" }),
    ).resolves.toBeUndefined();
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("no pasa redirectTo si la variable no está configurada", async () => {
    delete process.env.SUPABASE_RECOVERY_REDIRECT_URL;
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await useCase.execute({ email: "maria@diageo.com" });
    await flushBackground();

    expect(resetPasswordForEmail).toHaveBeenCalledWith("maria@diageo.com", {});
  });

  it("no envía nada y resuelve si el usuario no existe", async () => {
    exists.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: "nadie@example.com" }),
    ).resolves.toBeUndefined();
    await flushBackground();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    "over_email_send_rate_limit",
    "over_request_rate_limit",
    "unexpected_failure",
  ])("se calla el error de Supabase %s (sin 429)", async (code) => {
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "fallo", code },
    });

    await expect(
      useCase.execute({ email: "maria@diageo.com" }),
    ).resolves.toBeUndefined();
    await flushBackground();
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("se calla un rechazo inesperado del envío", async () => {
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockRejectedValue(new Error("red caída"));

    await expect(
      useCase.execute({ email: "maria@diageo.com" }),
    ).resolves.toBeUndefined();
    await flushBackground();
  });

  it("aplica el enfriamiento de 60 s antes de consultar la BD, exista o no", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] });
    exists.mockResolvedValue(false);

    await useCase.execute({ email: "nadie@example.com" });
    await useCase.execute({ email: "NADIE@example.com" });
    expect(exists).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_000);
    await useCase.execute({ email: "nadie@example.com" });
    expect(exists).toHaveBeenCalledTimes(2);
  });

  it("el enfriamiento es por correo", async () => {
    exists.mockResolvedValue(true);
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await useCase.execute({ email: "a@example.com" });
    await useCase.execute({ email: "b@example.com" });
    await flushBackground();

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(2);
  });
});
