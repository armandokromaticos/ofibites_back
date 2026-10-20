import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { OrderStatusGroup } from "../../../domain/services/order-status-groups";

export const ORDERS_MAX_TAKE = 50;

/** "" o solo espacios cuentan como "sin filtro"; el resto se recorta. */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export class GetOrdersQueryDto {
  @ApiPropertyOptional({
    enum: OrderStatusGroup,
    description:
      'Grupo visible de "Pedidos realizados" (received, scheduled, in_transit, delivered, cancelled).',
  })
  @IsOptional()
  @IsEnum(OrderStatusGroup, {
    message:
      "statusGroup solo admite: received, scheduled, in_transit, delivered, cancelled",
  })
  statusGroup?: OrderStatusGroup;

  @ApiPropertyOptional({
    example: "2026-10-01",
    description: "deliveryDate desde (YYYY-MM-DD, inclusive).",
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "deliveryDateFrom debe tener el formato YYYY-MM-DD",
  })
  @IsDateString(
    { strict: true },
    { message: "deliveryDateFrom no es una fecha válida" },
  )
  deliveryDateFrom?: string;

  @ApiPropertyOptional({
    example: "2026-10-31",
    description: "deliveryDate hasta (YYYY-MM-DD, inclusive).",
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "deliveryDateTo debe tener el formato YYYY-MM-DD",
  })
  @IsDateString(
    { strict: true },
    { message: "deliveryDateTo no es una fecha válida" },
  )
  deliveryDateTo?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4", { message: "branchId debe ser un UUID válido" })
  branchId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4", { message: "departmentId debe ser un UUID válido" })
  departmentId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      'Filtro "Usuario" del listado: quién hizo el pedido (Order.userId).',
  })
  @IsOptional()
  @IsUUID("4", { message: "userId debe ser un UUID válido" })
  userId?: string;

  @ApiPropertyOptional({
    example: "OF-2026-0007",
    maxLength: 50,
    description:
      "Busca por número de pedido (contiene, sin distinguir mayúsculas). No busca por producto todavía.",
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: "search debe ser un texto" })
  @MaxLength(50, { message: "search admite como máximo 50 caracteres" })
  search?: string;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    description:
      "Cuántas órdenes saltar. Si se envía junto con take, la respuesta pagina ({ data, total }).",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "skip debe ser un número entero" })
  @Min(0, { message: "skip no puede ser negativo" })
  skip?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: ORDERS_MAX_TAKE,
    description: `Cuántas devolver (máximo ${ORDERS_MAX_TAKE}). Si se envía (o skip), la respuesta pagina ({ data, total }).`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "take debe ser un número entero" })
  @Min(1, { message: "take debe ser al menos 1" })
  @Max(ORDERS_MAX_TAKE, {
    message: `take no puede ser mayor que ${ORDERS_MAX_TAKE}`,
  })
  take?: number;
}
