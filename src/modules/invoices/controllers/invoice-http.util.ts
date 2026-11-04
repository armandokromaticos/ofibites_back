import {
  BadRequestException,
  ParseUUIDPipe,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { CompanyMemberEntity } from "../../../core/domain/entities/company-member.entity";
import { Role } from "../../../core/domain/enums/role.enum";
import { InvoiceActor } from "../../../core/application/shared/invoice-access";

export const invoiceIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException("El id de la factura no es válido"),
});

export const paymentIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException("El id del pago no es válido"),
});

export function toInvoiceActor(
  user: { id: string; role: Role },
  member: CompanyMemberEntity | undefined,
): InvoiceActor {
  return {
    userId: user.id,
    role: user.role,
    member: member
      ? {
          companyId: member.companyId,
          role: member.role,
          canPayInvoices: member.canPayInvoices,
        }
      : null,
  };
}

/** `filename` ASCII de respaldo + `filename*` UTF-8 (RFC 6266 / 5987). */
export function contentDisposition(
  disposition: "inline" | "attachment",
  fileName: string,
): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Bytes privados: sin caché compartida y con su nombre. */
export function sendPrivateFile(
  res: Response,
  file: { buffer: Buffer; fileName: string; mimeType: string },
  disposition: "inline" | "attachment" = "inline",
  extraHeaders: Record<string, string> = {},
): StreamableFile {
  res.setHeader("Cache-Control", "private, no-store");
  // El navegador no debe adivinar otro tipo (p. ej. un "PDF" que sea HTML).
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }
  return new StreamableFile(file.buffer, {
    type: file.mimeType,
    length: file.buffer.length,
    disposition: contentDisposition(disposition, file.fileName),
  });
}
