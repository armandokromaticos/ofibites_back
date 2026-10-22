import { ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { MeResponseDto } from "../../dto/auth/me-response.dto";
import { GetMeUseCase } from "./get-me.use-case";
import { deleteAvatarBestEffort } from "./avatar-storage";
import type { AvatarActor } from "./upload-avatar.use-case";

/**
 * Quita la foto de perfil del usuario del token: `avatarUrl = null` y borra el
 * archivo del bucket (best-effort). Idempotente: sin foto no toca nada.
 * Devuelve la misma forma que `GET /auth/me`.
 */
@Injectable()
export class DeleteAvatarUseCase {
  private readonly logger = new Logger(DeleteAvatarUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  async execute(actor: AvatarActor): Promise<MeResponseDto> {
    const user = await this.userRepository.findUnique({
      where: { id: actor.id },
    });
    if (!user) {
      throw new ForbiddenException("Usuario no encontrado");
    }

    const currentUrl = user.avatarUrl;
    if (currentUrl) {
      // Primero la BD: así el perfil deja de apuntar al archivo aunque el
      // borrado en Storage falle.
      await this.userRepository.update({
        where: { id: actor.id },
        data: { avatarUrl: null },
      });
      await deleteAvatarBestEffort(
        this.supabaseService,
        this.logger,
        currentUrl,
        actor.id,
      );
    }

    return this.getMeUseCase.execute(actor.authId);
  }
}
