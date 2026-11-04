/**
 * El cupón dejó de poder consumirse al confirmar el pedido (inactivo, vencido,
 * sin usos, de otra empresa o ya usado por el usuario). La transacción del
 * checkout se revierte.
 */
export class CouponUnavailableException extends Error {
  constructor(couponId: string) {
    super(`El cupón ${couponId} ya no se puede consumir`);
    this.name = "CouponUnavailableException";
  }
}
