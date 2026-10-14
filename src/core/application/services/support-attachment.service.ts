import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { extname } from "node:path";
import { SupabaseService } from "../../infrastructure/supabase/supabase.service";

export interface SupportAttachmentInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const BUCKET = "support";

// Imágenes para capturas + PDF para facturas/comprobantes (mapa: "compartir archivo").
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

@Injectable()
export class SupportAttachmentService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Sube un adjunto del chat de soporte al bucket `support` bajo la carpeta de
   * la empresa y devuelve su URL pública. Devuelve null si no hay archivo.
   */
  async upload(
    companyId: string,
    file?: SupportAttachmentInput,
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Permitidos: ${Object.keys(
          ALLOWED_MIME_TO_EXT,
        ).join(", ")}`,
      );
    }

    const nameExt = extname(file.originalname || "")
      .replace(".", "")
      .toLowerCase();
    const finalExt =
      nameExt === ext || (ext === "jpg" && nameExt === "jpeg") ? nameExt : ext;
    const path = `${companyId}/${randomUUID()}.${finalExt}`;

    return this.supabaseService.uploadFile(
      BUCKET,
      path,
      file.buffer,
      file.mimetype,
    );
  }
}
