import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { ResetPasswordDto } from "../../dto/auth/reset-password.dto";

/**
 * Métodos de autenticación (claim `amr` del JWT) que habilitan el cambio de
 * contraseña sin pedir la anterior. GoTrue marca con `otp` las sesiones que
 * salen de un enlace de correo en el flujo implícito (recuperación incluida).
 * Es seguro aceptarlo porque el login de Ofibites es solo por contraseña
 * (`amr=password`): no hay magic link ni OTP de inicio de sesión.
 */
export const RECOVERY_AMR_METHODS: readonly string[] = ["recovery", "otp"];
/** Antigüedad máxima de la verificación de recuperación. */
export const RECOVERY_MAX_AGE_SECONDS = 60 * 60;

const INVALID_LINK_MESSAGE =
  "El enlace de recuperación no es válido o venció. Solicita uno nuevo.";
const UNAVAILABLE_MESSAGE =
  "No se pudo actualizar la contraseña en este momento. Inténtalo de nuevo en unos minutos.";

type AmrClaim = Array<{ method: string; timestamp: number } | string>;

/**
 * Cambia la contraseña con el access_token de la sesión de recuperación que
 * Supabase entrega en el enlace del correo, y cierra todas las sesiones.
 * Solo acepta tokens nacidos de un enlace de recuperación reciente: un access
 * token de sesión normal no sirve para cambiar la contraseña por aquí.
 */
@Injectable()
export class ResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const supabase = this.supabaseService.getAdmin();

    const { data, error: tokenError } = await this.callAuth("getUser", () =>
      supabase.auth.getUser(dto.accessToken),
    );
    if (tokenError) {
      this.throwIfUnavailable("getUser", tokenError);
    }
    const authUser = data?.user;
    if (tokenError || !authUser) {
      this.logger.warn(
        `Token de recuperación inválido: ${tokenError?.message ?? "sin usuario"}`,
      );
      throw new UnauthorizedException(INVALID_LINK_MESSAGE);
    }

    const { data: claimsData, error: claimsError } = await this.callAuth(
      "getClaims",
      () => supabase.auth.getClaims(dto.accessToken),
    );
    if (claimsError) {
      this.throwIfUnavailable("getClaims", claimsError);
    }
    if (
      claimsError ||
      !claimsData ||
      !this.isRecentRecovery(
        claimsData.claims.amr as AmrClaim | undefined,
        claimsData.claims.iat,
      )
    ) {
      this.logger.warn(
        `Token sin verificación de recuperación reciente para authId ${authUser.id} (amr=${this.describeAmr(claimsData?.claims.amr as AmrClaim | undefined)})${claimsError ? `: ${claimsError.message}` : ""}`,
      );
      throw new UnauthorizedException(INVALID_LINK_MESSAGE);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: dto.password },
    );
    if (updateError) {
      this.logger.warn(
        `No se pudo cambiar la contraseña de authId ${authUser.id}: ${updateError.message} (code=${updateError.code ?? "?"})`,
      );
      switch (updateError.code) {
        case "same_password":
          throw new BadRequestException(
            "La nueva contraseña debe ser distinta de la anterior.",
          );
        case "weak_password":
          throw new BadRequestException(
            "La contraseña es demasiado débil. Usa al menos 8 caracteres con mayúsculas, minúsculas, números y símbolos.",
          );
        case "validation_failed":
          throw new BadRequestException(
            "La contraseña no es válida. Revisa los requisitos e inténtalo de nuevo.",
          );
        default:
          throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
      }
    }

    // Best-effort: la contraseña ya cambió, así que estos fallos no se propagan.
    // updateMany: una cuenta de Auth sin fila en `users` no debe dar error.
    try {
      await this.userRepository.markPasswordChangedByAuthId(
        authUser.id,
        new Date(),
      );
    } catch (err) {
      this.logger.error(
        `No se pudo marcar passwordChangedAt de authId ${authUser.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      const { error: signOutError } = await supabase.auth.admin.signOut(
        dto.accessToken,
        "global",
      );
      if (signOutError) {
        this.logger.error(
          `No se pudieron cerrar las sesiones de authId ${authUser.id}: ${signOutError.message}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `No se pudieron cerrar las sesiones de authId ${authUser.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(`Contraseña restablecida para authId ${authUser.id}`);
  }

  /**
   * Ejecuta una llamada de lectura a Supabase Auth. Si lanza un AuthError
   * "normal" (token mal formado, firma inválida…) se trata como enlace
   * inválido (401); si lanza otra cosa o un fallo de red/5xx, 503.
   */
  private async callAuth<T>(operation: string, fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (err) {
      if (isAuthError(err)) {
        this.throwIfUnavailable(operation, err);
        this.logger.warn(`Token de recuperación inválido: ${err.message}`);
        throw new UnauthorizedException(INVALID_LINK_MESSAGE);
      }
      this.logger.error(
        `Fallo inesperado en Supabase ${operation}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  /** 503 si el error de Supabase es de red o del servidor (no del token). */
  private throwIfUnavailable(operation: string, err: unknown): void {
    const status = (err as { status?: unknown } | null)?.status;
    if (
      isAuthRetryableFetchError(err) ||
      (typeof status === "number" && status >= 500)
    ) {
      this.logger.error(
        `Supabase ${operation} no disponible: ${err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err)}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  /**
   * True si el `amr` trae un método de recuperación de hace ≤ 1 h. Con el
   * formato de strings (sin timestamp) se usa el `iat` del token.
   */
  private isRecentRecovery(amr: AmrClaim | undefined, iat?: number): boolean {
    if (!Array.isArray(amr)) {
      return false;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return amr.some((entry) => {
      const method = typeof entry === "string" ? entry : entry?.method;
      const timestamp = typeof entry === "string" ? iat : entry?.timestamp;
      return (
        typeof method === "string" &&
        RECOVERY_AMR_METHODS.includes(method) &&
        typeof timestamp === "number" &&
        nowSeconds - timestamp <= RECOVERY_MAX_AGE_SECONDS
      );
    });
  }

  /** Métodos del `amr` para el log (sin timestamps ni datos del token). */
  private describeAmr(amr: AmrClaim | undefined): string {
    if (!Array.isArray(amr)) {
      return "ninguno";
    }
    return amr
      .map((entry) => (typeof entry === "string" ? entry : entry?.method))
      .join(",");
  }
}
