import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { basename } from "node:path";
import { SupabaseService } from "../../infrastructure/supabase/supabase.service";

/**
 * Buckets **privados** de Supabase (T-06). Hay que crearlos a mano al
 * desplegar (Storage → New bucket, sin "Public bucket"). Los archivos se
 * sirven siempre a través del back, nunca por URL pública.
 */
export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const INVOICE_PDF_BUCKET = "invoices";

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const FISCAL_PDF_MAX_BYTES = 10 * 1024 * 1024;

export interface UploadedFileInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface StoredFile {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

type DetectedKind = "image/jpeg" | "image/png" | "application/pdf";

const EXTENSIONS: Record<DetectedKind, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

/** Tipo real por la firma del archivo (no por el MIME declarado). */
export function detectFileKind(buffer: Buffer): DetectedKind | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    buffer.length >= png.length &&
    png.every((byte, i) => buffer[i] === byte)
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString("latin1") === "%PDF"
  ) {
    return "application/pdf";
  }
  return null;
}

function normalizeMime(mime: string): string {
  const lower = (mime || "").toLowerCase();
  return lower === "image/jpg" || lower === "image/pjpeg"
    ? "image/jpeg"
    : lower;
}

/** Nombre mostrable: sin rutas ni caracteres de control, máx. 120. */
export function sanitizeFileName(original: string, fallback: string): string {
  const cleaned = Array.from(basename(original || ""))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f && !'"\\/'.includes(char);
    })
    .join("")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Valida (por MIME **y** firma) y sube comprobantes de pago y PDF fiscales a
 * sus buckets privados; descarga para servirlos.
 */
@Injectable()
export class InvoiceFileStorageService {
  private readonly logger = new Logger(InvoiceFileStorageService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** JPG, PNG o PDF, máx. 5 MB. Lanza 400 en español si no cumple. */
  validateProof(file: UploadedFileInput | undefined): DetectedKind {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException("Sube el comprobante");
    }
    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      throw new BadRequestException(
        "El comprobante no puede pesar más de 5 MB",
      );
    }
    const kind = detectFileKind(file.buffer);
    if (!kind || normalizeMime(file.mimetype) !== kind) {
      throw new BadRequestException("El comprobante debe ser JPG, PNG o PDF");
    }
    return kind;
  }

  /** Solo PDF (`%PDF`), máx. 10 MB. */
  validateFiscalPdf(file: UploadedFileInput | undefined): void {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException("Sube el PDF de la factura fiscal");
    }
    if (file.size > FISCAL_PDF_MAX_BYTES) {
      throw new BadRequestException(
        "El PDF de la factura no puede pesar más de 10 MB",
      );
    }
    if (
      detectFileKind(file.buffer) !== "application/pdf" ||
      normalizeMime(file.mimetype) !== "application/pdf"
    ) {
      throw new BadRequestException("La factura fiscal debe ser un PDF");
    }
  }

  async uploadProof(
    companyId: string,
    invoiceId: string,
    file: UploadedFileInput,
    kind: DetectedKind,
  ): Promise<StoredFile> {
    const ext = EXTENSIONS[kind];
    const path = `${companyId}/${invoiceId}/${randomUUID()}.${ext}`;
    await this.supabase.uploadPrivateFile(
      PAYMENT_PROOF_BUCKET,
      path,
      file.buffer,
      kind,
    );
    return {
      path,
      fileName: sanitizeFileName(file.originalname, `comprobante.${ext}`),
      mimeType: kind,
      sizeBytes: file.size,
    };
  }

  async uploadFiscalPdf(
    companyId: string,
    invoiceId: string,
    file: UploadedFileInput,
  ): Promise<string> {
    const path = `${companyId}/${invoiceId}/fiscal-${randomUUID()}.pdf`;
    return this.supabase.uploadPrivateFile(
      INVOICE_PDF_BUCKET,
      path,
      file.buffer,
      "application/pdf",
    );
  }

  download(bucket: string, path: string): Promise<Buffer> {
    return this.supabase.downloadFile(bucket, path);
  }

  /** Borrado de limpieza: si falla solo se registra (queda un huérfano). */
  async removeQuietly(bucket: string, path: string | null): Promise<void> {
    if (!path) return;
    try {
      await this.supabase.deleteFile(bucket, path);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`No se pudo borrar ${bucket}/${path}: ${err.message}`);
    }
  }
}
