import { BadRequestException, ConflictException } from "@nestjs/common";

/**
 * Códigos estables de los errores de negocio de `POST /orders/checkout`. El
 * front decide por `code`, no por el texto de `message` (que puede cambiar).
 */
export const CheckoutErrorCode = {
  DELIVERY_CUTOFF: "DELIVERY_CUTOFF",
  DELIVERY_HORIZON: "DELIVERY_HORIZON",
  CART_EMPTY: "CART_EMPTY",
  CART_ITEMS_UNAVAILABLE: "CART_ITEMS_UNAVAILABLE",
  ADDRESS_NOT_SHIPPING: "ADDRESS_NOT_SHIPPING",
  CART_CHANGED: "CART_CHANGED",
  TOTAL_CHANGED: "TOTAL_CHANGED",
} as const;

export type CheckoutErrorCode =
  (typeof CheckoutErrorCode)[keyof typeof CheckoutErrorCode];

/**
 * Cuerpo con la misma forma que el de Nest por defecto (`statusCode`, `error`,
 * `message`) más `code` y, si hace falta, datos extra. Al pasar un objeto a la
 * excepción HTTP, Nest lo devuelve tal cual: no hace falta un filtro propio.
 */
export function checkoutBadRequest(
  code: CheckoutErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: "Bad Request",
    message,
    code,
    ...extra,
  });
}

export function checkoutConflict(
  code: CheckoutErrorCode,
  message: string,
): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: "Conflict",
    message,
    code,
  });
}
