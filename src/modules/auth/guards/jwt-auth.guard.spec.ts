import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SignJWT } from "jose";
import type { ICompanyMemberRepository } from "../../../core/domain/repositories/company-member.repository.interface";
import type { SupabaseService } from "../../../core/infrastructure/supabase/supabase.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

const SUPABASE_URL = "https://proyecto.supabase.co";
const SECRETO = "secreto-de-prueba-con-longitud-suficiente-1234";

function firmar(
  claims: { iss?: string; aud?: string; exp?: number } = {},
  secreto = SECRETO,
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: "ana@empresa.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("auth-1")
    .setIssuer(claims.iss ?? `${SUPABASE_URL}/auth/v1`)
    .setAudience(claims.aud ?? "authenticated")
    .setIssuedAt(ahora - 10)
    .setExpirationTime(claims.exp ?? ahora + 3600)
    .sign(new TextEncoder().encode(secreto));
}

function contexto(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  const getUser = jest.fn();
  const supabaseService = {
    getAdmin: () => ({ auth: { getUser } }),
  } as unknown as SupabaseService;
  const companyMemberRepository = {
    touchLastSeenIfStale: jest.fn().mockResolvedValue(undefined),
  } as unknown as ICompanyMemberRepository;
  const guard = new JwtAuthGuard(supabaseService, companyMemberRepository);

  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_JWT_SECRET = SECRETO;
    getUser.mockReset();
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  async function activar(token?: string) {
    const request: Record<string, unknown> = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    await guard.canActivate(contexto(request));
    return request;
  }

  it("acepta un HS256 válido y deja authId y email sin llamar a Supabase", async () => {
    const request = await activar(await firmar());

    expect(request.user).toEqual({
      authId: "auth-1",
      email: "ana@empresa.com",
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rechaza un token caducado", async () => {
    const token = await firmar({ exp: Math.floor(Date.now() / 1000) - 60 });

    await expect(activar(token)).rejects.toThrow(
      new UnauthorizedException("Token inválido o expirado"),
    );
  });

  it("rechaza un aud distinto de authenticated", async () => {
    await expect(activar(await firmar({ aud: "anon" }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rechaza un iss de otro proyecto", async () => {
    const token = await firmar({ iss: "https://otro.supabase.co/auth/v1" });

    await expect(activar(token)).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza una firma con otro secreto", async () => {
    const token = await firmar({}, "otro-secreto-de-prueba-con-longitud-5678");

    await expect(activar(token)).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza la petición sin token", async () => {
    await expect(activar()).rejects.toThrow(
      new UnauthorizedException("Token no proporcionado"),
    );
  });

  it("sin SUPABASE_JWT_SECRET valida el HS256 con auth.getUser()", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    getUser.mockResolvedValue({
      data: { user: { id: "auth-2", email: "luis@empresa.com" } },
      error: null,
    });
    const token = await firmar();

    const request = await activar(token);

    expect(getUser).toHaveBeenCalledWith(token);
    expect(request.user).toEqual({
      authId: "auth-2",
      email: "luis@empresa.com",
    });
  });
});
