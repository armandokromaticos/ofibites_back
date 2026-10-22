import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { ChangePasswordDto } from "../../dto/auth/change-password.dto";

export const WRONG_CURRENT_PASSWORD_MESSAGE =
  "La contraseña actual no es correcta";
export const SAME_PASSWORD_MESSAGE =
  "La nueva contraseña debe ser distinta de la actual";
const UNAVAILABLE_MESSAGE =
  "No se pudo cambiar la contraseña en este momento. Inténtalo de nuevo en unos minutos.";
const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

export interface ChangePasswordActor {
  id: string;
  authId: string;
  email: string;
}

/**
 * Cambio de contraseña con sesión iniciada ("Mi perfil" → Contraseña).
 * Verifica la contraseña actual en un cliente Supabase desechable (no toca la
 * sesión del request ni el cliente admin), la actualiza, marca
 * `User.passwordChangedAt` y cierra las demás sesiones del usuario: el token
 * del request sigue siendo válido.
 *
 * La contraseña actual incorrecta responde 400 (no 401) para que el front no
 * lo confunda con una sesión vencida.
 */
@Injectable()
export class ChangePasswordUseCase {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(
    actor: ChangePasswordActor,
    accessToken: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(SAME_PASSWORD_MESSAGE);
    }

    await this.verifyCurrentPassword(actor, dto.currentPassword);

    const admin = this.supabaseService.getAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      actor.authId,
      { password: dto.newPassword },
    );
    if (updateError) {
      this.logger.warn(
        `No se pudo cambiar la contraseña de authId ${actor.authId}: ${updateError.message} (code=${updateError.code ?? "?"})`,
      );
      switch (updateError.code) {
        case "same_password":
          throw new BadRequestException(SAME_PASSWORD_MESSAGE);
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

    // A partir de aquí la contraseña ya cambió: los fallos se registran, no se propagan.
    try {
      await this.userRepository.update({
        where: { id: actor.id },
        data: { passwordChangedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `No se pudo marcar passwordChangedAt del usuario ${actor.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // "others": cierra el resto de sesiones y mantiene la del token del
    // request (la de la verificación ya se cerró en verifyCurrentPassword).
    try {
      const { error: signOutError } = await admin.auth.admin.signOut(
        accessToken,
        "others",
      );
      if (signOutError) {
        this.logger.error(
          `No se pudieron cerrar las otras sesiones de authId ${actor.authId}: ${signOutError.message}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `No se pudieron cerrar las otras sesiones de authId ${actor.authId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(`Contraseña cambiada por el usuario ${actor.id}`);
  }

  private async verifyCurrentPassword(
    actor: ChangePasswordActor,
    currentPassword: string,
  ): Promise<void> {
    const client = this.supabaseService.createEphemeralClient();
    let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>;
    try {
      result = await client.auth.signInWithPassword({
        email: actor.email,
        password: currentPassword,
      });
    } catch (err) {
      this.logger.error(
        `Fallo inesperado al verificar la contraseña de authId ${actor.authId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }

    const { data, error } = result;
    // La verificación abre una sesión en Supabase: se cierra ya, pase lo que
    // pase después (si updateUserById falla, no queda huérfana).
    if (data?.session) {
      await this.closeEphemeralSession(client, actor.authId);
    }
    if (error) {
      const status = (error as { status?: unknown }).status;
      if (
        isAuthRetryableFetchError(error) ||
        (typeof status === "number" && status >= 500)
      ) {
        this.logger.error(
          `Supabase no disponible al verificar la contraseña: ${error.message}`,
        );
        throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
      }
      if (status === 429 || error.code === "over_request_rate_limit") {
        throw new HttpException(
          RATE_LIMIT_MESSAGE,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.warn(
        `Contraseña actual incorrecta para authId ${actor.authId} (code=${error.code ?? "?"})`,
      );
      throw new BadRequestException(WRONG_CURRENT_PASSWORD_MESSAGE);
    }

    if (data.user?.id !== actor.authId) {
      this.logger.warn(
        `La verificación devolvió otro usuario de Auth (esperado ${actor.authId})`,
      );
      throw new BadRequestException(WRONG_CURRENT_PASSWORD_MESSAGE);
    }
  }

  /**
   * Cierra solo la sesión del cliente efímero. Ojo: el scope por defecto de
   * `signOut` es "global" y cerraría también la sesión del request.
   */
  private async closeEphemeralSession(
    client: ReturnType<SupabaseService["createEphemeralClient"]>,
    authId: string,
  ): Promise<void> {
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        this.logger.warn(
          `No se pudo cerrar la sesión de verificación de authId ${authId}: ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo cerrar la sesión de verificación de authId ${authId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
