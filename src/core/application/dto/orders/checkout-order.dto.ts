import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { trimStringValue } from "../../shared/trim-string.transform";

/** Opcional recortado: "" o solo espacios cuentan como ausente. */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Body de `POST /orders/checkout`. Las líneas, los precios y la empresa salen
 * del carrito de `X-Company-Id`: aquí solo van los datos de entrega.
 */
export class CheckoutOrderDto {
  @ApiProperty({
    format: "uuid",
    description: "Dirección de entrega de la empresa (isShipping = true)",
  })
  @IsUUID("4", { message: "deliveryAddressId debe ser un UUID válido" })
  deliveryAddressId: string;

  @ApiProperty({
    example: "2026-10-20",
    description:
      "Fecha de entrega YYYY-MM-DD (hora de Caracas). Desde mañana; para mañana, solo antes de las 15:00 de hoy",
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "deliveryDate debe tener el formato YYYY-MM-DD",
  })
  @IsDateString(
    { strict: true },
    { message: "deliveryDate no es una fecha válida" },
  )
  deliveryDate: string;

  @ApiProperty({ example: "10:30", description: "Hora de entrega HH:mm" })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "deliveryTime debe tener el formato HH:mm",
  })
  deliveryTime: string;

  @ApiProperty({ example: "María Pérez", minLength: 2, maxLength: 120 })
  @Transform(trimStringValue)
  @IsString({ message: "receiverName debe ser texto" })
  @Length(2, 120, {
    message: "receiverName debe tener entre 2 y 120 caracteres",
  })
  receiverName: string;

  @ApiProperty({
    example: "+58 412-555-1234",
    description:
      "7 a 20 caracteres: dígitos, espacios, + y -, con al menos 7 dígitos",
  })
  @Transform(trimStringValue)
  @IsString({ message: "receiverPhone debe ser texto" })
  @IsNotEmpty({ message: "receiverPhone es obligatorio" })
  // Espacio literal, no \s: saltos de línea o tabuladores no valen.
  @Matches(/^(?=(?:\D*\d){7})[\d +-]{7,20}$/, {
    message:
      "receiverPhone debe tener entre 7 y 20 caracteres (dígitos, espacios, + o -) y al menos 7 dígitos",
  })
  receiverPhone: string;

  @ApiPropertyOptional({ example: "Piso 3, oficina 3B", maxLength: 120 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: "addressDetail debe ser texto" })
  @MaxLength(120, {
    message: "addressDetail no puede superar 120 caracteres",
  })
  addressDetail?: string;

  @ApiPropertyOptional({ example: "Frente a la plaza", maxLength: 200 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: "addressReference debe ser texto" })
  @MaxLength(200, {
    message: "addressReference no puede superar 200 caracteres",
  })
  addressReference?: string;

  @ApiPropertyOptional({ example: "Tocar en recepción", maxLength: 500 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: "notes debe ser texto" })
  @MaxLength(500, { message: "notes no puede superar 500 caracteres" })
  notes?: string;

  @ApiPropertyOptional({
    example: 135.5,
    description:
      "summary.total que el usuario vio en la revisión. Si viene y no coincide con el total recalculado en el servidor → 409",
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: "expectedTotal debe ser un número con hasta 2 decimales" },
  )
  @Min(0, { message: "expectedTotal no puede ser negativo" })
  expectedTotal?: number;
}
