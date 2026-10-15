import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { ForgotPasswordDto } from "../../dto/auth/forgot-password.dto";
import { maskEmail } from "../../shared/mask-email.util";

/** Tiempo mínimo entre dos solicitudes para el mismo correo. */
export const FORGOT_PASSWORD_COOLDOWN_MS = 60_000;
/** A partir de este tamaño se purgan las entradas vencidas del enfriamiento. */
const COOLDOWN_PRUNE_THRESHOLD = 1_000;

/**
 * Envía el correo de recuperación de contraseña de Supabase.
 *
 * Para no revelar qué correos están registrados, la respuesta es idéntica
 * (y de igual duración) exista o no la cuenta:
 * - el enfriamiento por correo se aplica antes de consultar la BD;
 * - el envío a Supabase se lanza en segundo plano, sin esperarlo;
 * - cualquier error de Supabase (incluido su límite de tasa) solo se loguea.
 * El límite por IP lo pone el ThrottlerGuard del controller.
 */
@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);
  /** sha256(email) → instante (ms) de la última solicitud aceptada. */
  private readonly lastRequestByEmail = new Map<string, number>();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const maskedEmail = maskEmail(email);

    if (this.isInCooldown(email)) {
      this.logger.log(
        `Recuperación ignorada por enfriamiento (${maskedEmail})`,
      );
      return;
    }

    // Sin authId no hay cuenta en Supabase Auth; los invitados pendientes sí
    // tienen authId y pueden usar este flujo para fijar su contraseña.
    const exists = await this.userRepository.exists({
      where: {
        email: { equals: email, mode: "insensitive" },
        authId: { not: null },
        isActive: true,
      },
    });
    if (!exists) {
      this.logger.log(
        `Recuperación solicitada para un correo sin cuenta activa (${maskedEmail}); no se envía nada`,
      );
      return;
    }

    this.sendRecoveryEmail(email, maskedEmail);
  }

  /** Lanza el envío sin esperarlo: el tiempo de respuesta no depende de Supabase. */
  private sendRecoveryEmail(email: string, maskedEmail: string): void {
    const redirectTo = process.env.SUPABASE_RECOVERY_REDIRECT_URL?.trim();
    void this.supabaseService
      .getAdmin()
      .auth.resetPasswordForEmail(email, {
        ...(redirectTo ? { redirectTo } : {}),
      })
      .then(({ error }) => {
        if (error) {
          this.logger.warn(
            `Error en Supabase resetPasswordForEmail (${maskedEmail}): ${error.message} (code=${error.code ?? "?"})`,
          );
          return;
        }
        this.logger.log(`Correo de recuperación enviado (${maskedEmail})`);
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Fallo inesperado en resetPasswordForEmail (${maskedEmail}): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  /**
   * Devuelve true si el correo ya pidió un enlace hace menos del enfriamiento;
   * si no, registra esta solicitud. En memoria: por instancia del proceso.
   */
  private isInCooldown(email: string): boolean {
    const now = Date.now();
    const key = createHash("sha256").update(email).digest("hex");
    const last = this.lastRequestByEmail.get(key);
    if (last !== undefined && now - last < FORGOT_PASSWORD_COOLDOWN_MS) {
      return true;
    }
    // delete + set mantiene el Map ordenado por instante de la última
    // solicitud (orden de inserción), de la más antigua a la más reciente.
    this.lastRequestByEmail.delete(key);
    this.lastRequestByEmail.set(key, now);
    if (this.lastRequestByEmail.size > COOLDOWN_PRUNE_THRESHOLD) {
      // Purga desde la más antigua y para en la primera vigente: O(1) amortizado.
      for (const [k, t] of this.lastRequestByEmail) {
        if (now - t < FORGOT_PASSWORD_COOLDOWN_MS) {
          break;
        }
        this.lastRequestByEmail.delete(k);
      }
    }
    return false;
  }
}
