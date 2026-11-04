import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { PaymentMethod } from "../../../domain/enums/payment-method.enum";
import { InvoicePaymentStatus } from "../../../domain/enums/invoice-payment-status.enum";
import { trimStringValue } from "../../shared/trim-string.transform";

export const INVOICES_MAX_TAKE = 50;

/** "" o solo espacios = no enviado; el resto se recorta. */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Los campos del multipart llegan como texto: "420.38" → 420.38. */
function toNumber({ value }: { value: unknown }): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return value;
  const parsed = Number(value.trim());
  return Number.isNaN(parsed) ? value : parsed;
}

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

/** Campos de texto de `POST /invoices/:id/payments` (el archivo va en `file`). */
export class CreateInvoicePaymentDto {
  @ApiProperty({
    example: "2026-09-27",
    description: "Fecha del pago (YYYY-MM-DD)",
  })
  @Transform(trimStringValue)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "paymentDate debe tener el formato YYYY-MM-DD",
  })
  @IsDateString(
    { strict: true },
    { message: "paymentDate no es una fecha válida" },
  )
  paymentDate: string;

  @ApiProperty({ enum: PaymentMethod, enumName: "PaymentMethod" })
  @IsEnum(PaymentMethod, {
    message:
      "method solo admite: MOBILE_PAYMENT, TRANSFER_VES, TRANSFER_USD, ZELLE",
  })
  method: PaymentMethod;

  @ApiPropertyOptional({ example: "Banesco", maxLength: 100 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100, { message: "El banco no puede tener más de 100 caracteres" })
  bank?: string;

  @ApiProperty({ example: "0102-88431", minLength: 1, maxLength: 60 })
  @Transform(trimStringValue)
  @IsString({ message: "Escribe la referencia o el número de confirmación" })
  @Length(1, 60, {
    message:
      "Escribe la referencia o el número de confirmación (hasta 60 caracteres)",
  })
  reference: string;

  @ApiProperty({
    example: 420.38,
    description: "Monto en USD (> 0, hasta 2 decimales, ≤ saldo)",
  })
  @Transform(toNumber)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: "amount debe ser un número con hasta 2 decimales" },
  )
  @IsPositive({ message: "El monto debe ser mayor que 0" })
  amount: number;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Comprobante en revisión que se sustituye en la misma transacción",
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID("4", { message: "replacesPaymentId debe ser un UUID válido" })
  replacesPaymentId?: string;
}

export class RejectInvoicePaymentDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Transform(trimStringValue)
  @IsString({ message: "Escribe el motivo del rechazo" })
  @Length(5, 500, {
    message: "Escribe el motivo del rechazo (entre 5 y 500 caracteres)",
  })
  reason: string;
}

export class UploadFiscalPdfDto {
  @ApiPropertyOptional({ example: "00012345", maxLength: 50 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(50, {
    message: "El número fiscal no puede tener más de 50 caracteres",
  })
  fiscalNumber?: string;
}

export class FileDispositionQueryDto {
  @ApiPropertyOptional({ enum: ["inline", "attachment"], default: "inline" })
  @IsOptional()
  @IsIn(["inline", "attachment"], {
    message: "disposition solo admite: inline, attachment",
  })
  disposition?: "inline" | "attachment";
}

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({
    enum: InvoicePaymentStatus,
    enumName: "InvoicePaymentStatus",
  })
  @IsOptional()
  @IsEnum(InvoicePaymentStatus, {
    message:
      "paymentStatus solo admite: PAID, VOID, IN_REVIEW, OVERDUE, REJECTED, PENDING",
  })
  paymentStatus?: InvoicePaymentStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID("4", { message: "companyId debe ser un UUID válido" })
  companyId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: "overdue debe ser true o false" })
  overdue?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "skip debe ser un entero" })
  @Min(0, { message: "skip no puede ser negativo" })
  skip?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: INVOICES_MAX_TAKE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "take debe ser un entero" })
  @Min(1, { message: "take debe ser al menos 1" })
  @Max(INVOICES_MAX_TAKE, {
    message: `take no puede ser mayor que ${INVOICES_MAX_TAKE}`,
  })
  take?: number;
}
