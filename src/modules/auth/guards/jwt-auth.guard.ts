import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { SupabaseService } from "../../../core/infrastructure/supabase/supabase.service";
import type { ICompanyMemberRepository } from "../../../core/domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../core/domain/repositories/company-member.repository.interface";

const COMPANY_ID_HEADER = "x-company-id";
const LAST_SEEN_DEBOUNCE_MS = 5 * 60 * 1000;

// A nivel de módulo y no de instancia: Nest crea un JwtAuthGuard por cada
// feature module que lo usa, y el JWKS (que cachea las claves) debe ser uno.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let avisoSinSecretoEmitido = false;

function supabaseAuthUrl(): string {
  return `${(process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")}/auth/v1`;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Token no proporcionado");
    }

    const user = await this.verificarToken(token);

    if (!user) {
      throw new UnauthorizedException("Token inválido o expirado");
    }

    request["user"] = user;

    this.touchLastSeen(request, user.authId);

    return true;
  }

  /**
   * Verifica el JWT en local (firma, `exp`, `iss`, `aud`) sin ir a Supabase
   * Auth. Asimétrico (RS256/ES256) contra el JWKS del proyecto; HS256 legacy
   * contra `SUPABASE_JWT_SECRET`, o con `auth.getUser()` si no está definido.
   */
  private async verificarToken(
    token: string,
  ): Promise<{ authId: string; email: string } | null> {
    let payload: JWTPayload;
    try {
      const { alg } = decodeProtectedHeader(token);
      const opciones = { issuer: supabaseAuthUrl(), audience: "authenticated" };

      if (alg === "HS256") {
        const secreto = process.env.SUPABASE_JWT_SECRET;
        if (!secreto) {
          return this.verificarConSupabase(token);
        }
        ({ payload } = await jwtVerify(
          token,
          new TextEncoder().encode(secreto),
          { ...opciones, algorithms: ["HS256"] },
        ));
      } else {
        jwks ??= createRemoteJWKSet(
          new URL(`${supabaseAuthUrl()}/.well-known/jwks.json`),
        );
        ({ payload } = await jwtVerify(token, jwks, {
          ...opciones,
          algorithms: ["RS256", "ES256"],
        }));
      }
    } catch {
      return null;
    }

    if (!payload.sub) {
      return null;
    }
    return {
      authId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
    };
  }

  private async verificarConSupabase(
    token: string,
  ): Promise<{ authId: string; email: string } | null> {
    if (!avisoSinSecretoEmitido) {
      avisoSinSecretoEmitido = true;
      this.logger.warn(
        "Token HS256 sin SUPABASE_JWT_SECRET: se valida con auth.getUser() (lento). Define la variable.",
      );
    }
    const { data, error } = await this.supabaseService
      .getAdmin()
      .auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return { authId: data.user.id, email: data.user.email ?? "" };
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private touchLastSeen(request: Request, authId: string): void {
    const headerValue = request.headers[COMPANY_ID_HEADER];
    const companyId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!companyId) {
      return;
    }

    void this.companyMemberRepository
      .touchLastSeenIfStale(authId, companyId, LAST_SEEN_DEBOUNCE_MS)
      .catch((err: unknown) => {
        this.logger.error(
          `Error updating lastSeenAt for authId=${authId} companyId=${companyId}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
  }
}
