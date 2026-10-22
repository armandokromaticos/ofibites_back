import { Logger } from "@nestjs/common";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";

/** Bucket público de fotos de perfil (T-30c). Ruta: `<userId>/<uuid>.<jpg|png>`. */
export const AVATAR_BUCKET = "avatars";

/** Igual que el `fileSizeLimit` del bucket `avatars`. */
export const AVATAR_MAX_BYTES = 2_000_000;

export type AvatarImageType = {
  mimetype: "image/jpeg" | "image/png";
  ext: "jpg" | "png";
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((byte, i) => buffer[i] === byte)
  );
}

/** Tipo real por los bytes mágicos; `null` si no es JPEG ni PNG. */
export function detectAvatarImageType(buffer: Buffer): AvatarImageType | null {
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return { mimetype: "image/png", ext: "png" };
  }
  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return { mimetype: "image/jpeg", ext: "jpg" };
  }
  return null;
}

/**
 * Ruta dentro del bucket `avatars` de una URL pública guardada en
 * `User.avatarUrl`, o `null` si la URL no es de ese bucket o no está en la
 * carpeta del usuario (en ese caso no se borra nada).
 */
export function avatarPathFromUrl(
  supabaseService: SupabaseService,
  url: string,
  userId: string,
): string | null {
  const prefix = supabaseService.getPublicUrl(AVATAR_BUCKET, "");
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return null;
  return path;
}

/**
 * Reintenta una vez tras una espera corta. Mitiga fallos transitorios del
 * pooler de conexiones de Storage (p. ej. "row-level security" espurio en
 * una conexión reciclada) que no se repiten en una conexión nueva.
 */
export async function withStorageRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fn();
  }
}

/** Borrado best-effort de la foto anterior: si falla, solo deja log. */
export async function deleteAvatarBestEffort(
  supabaseService: SupabaseService,
  logger: Logger,
  url: string,
  userId: string,
): Promise<void> {
  const path = avatarPathFromUrl(supabaseService, url, userId);
  if (!path) return;
  try {
    await supabaseService.deleteFile(AVATAR_BUCKET, path);
  } catch (error) {
    logger.warn(
      `No se pudo borrar la foto ${AVATAR_BUCKET}/${path} del usuario ${userId}: ${String(error)}`,
    );
  }
}
