import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { MeResponseDto } from "../../dto/auth/me-response.dto";
import { GetMeUseCase } from "./get-me.use-case";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  deleteAvatarBestEffort,
  detectAvatarImageType,
} from "./avatar-storage";

export interface AvatarActor {
  id: string;
  authId: string;
}

export interface AvatarFileInput {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const ALLOWED_MIMETYPES = ["image/jpeg", "image/png"];

/**
 * Sube la foto de perfil del usuario del token al bucket `avatars`, guarda su
 * URL pública en `User.avatarUrl` y borra la anterior (best-effort).
 * Devuelve la misma forma que `GET /auth/me`.
 */
@Injectable()
export class UploadAvatarUseCase {
  private readonly logger = new Logger(UploadAvatarUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  async execute(
    actor: AvatarActor,
    file: AvatarFileInput | undefined,
  ): Promise<MeResponseDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Envía la imagen en el campo file");
    }
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        "Formato no permitido: la foto debe ser JPG o PNG",
      );
    }
    if (file.size > AVATAR_MAX_BYTES || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException("La foto no puede superar los 2 MB");
    }
    // El mimetype lo declara el cliente: el tipo real sale de los bytes.
    const imageType = detectAvatarImageType(file.buffer);
    if (!imageType) {
      throw new BadRequestException(
        "El archivo no es una imagen JPG o PNG válida",
      );
    }

    const user = await this.userRepository.findUnique({
      where: { id: actor.id },
    });
    if (!user) {
      throw new ForbiddenException("Usuario no encontrado");
    }
    const previousUrl = user.avatarUrl;

    const path = `${actor.id}/${randomUUID()}.${imageType.ext}`;
    let publicUrl: string;
    try {
      publicUrl = await this.supabaseService.uploadFile(
        AVATAR_BUCKET,
        path,
        file.buffer,
        imageType.mimetype,
      );
    } catch (error) {
      this.logger.error(
        `Fallo al subir la foto de perfil del usuario ${actor.id}: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        "No se pudo guardar la foto. Inténtalo de nuevo en unos minutos.",
      );
    }

    try {
      // Comparación-e-intercambio: solo actualiza si `avatarUrl` sigue
      // siendo el que leímos al principio. Si otra subida concurrente del
      // mismo usuario ganó la carrera, Prisma no encuentra fila que cumpla
      // la condición y lanza P2025 (ver catch).
      await this.userRepository.update({
        where: { id: actor.id, avatarUrl: previousUrl },
        data: { avatarUrl: publicUrl },
      });
    } catch (error) {
      // Sin referencia en la BD, el archivo recién subido quedaría huérfano.
      await deleteAvatarBestEffort(
        this.supabaseService,
        this.logger,
        publicUrl,
        actor.id,
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new ConflictException(
          "Tu foto se actualizó desde otra sesión justo ahora. Vuelve a intentarlo.",
        );
      }
      throw error;
    }

    if (previousUrl && previousUrl !== publicUrl) {
      await deleteAvatarBestEffort(
        this.supabaseService,
        this.logger,
        previousUrl,
        actor.id,
      );
    }

    return this.getMeUseCase.execute(actor.authId);
  }
}
