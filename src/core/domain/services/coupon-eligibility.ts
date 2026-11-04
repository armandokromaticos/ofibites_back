import { CouponEntity } from "../entities/coupon.entity";

/**
 * Motivo por el que un cupón no aplica a un carrito. Mismo orden de
 * comprobación en `POST /cart/coupon`, en la vista del carrito y en el
 * checkout: existe → vigente (`isValid`) → empresa → ya usado por el usuario.
 */
export const CouponRejection = {
  NOT_FOUND: "NOT_FOUND",
  NOT_VALID: "NOT_VALID",
  OTHER_COMPANY: "OTHER_COMPANY",
  ALREADY_USED: "ALREADY_USED",
} as const;

export type CouponRejection =
  (typeof CouponRejection)[keyof typeof CouponRejection];

export interface CouponEligibilityContext {
  companyId: string;
  userId: string;
}

/**
 * `null` si el cupón aplica. Para `ALREADY_USED`, `coupon.usages` debe traer al
 * menos los usos del usuario (si no se cargaron, se considera no usado).
 */
export function couponRejectionFor(
  coupon: CouponEntity | null,
  context: CouponEligibilityContext,
): CouponRejection | null {
  if (!coupon) return CouponRejection.NOT_FOUND;
  if (!coupon.isValid()) return CouponRejection.NOT_VALID;
  if (coupon.companyId && coupon.companyId !== context.companyId) {
    return CouponRejection.OTHER_COMPANY;
  }
  if (coupon.hasBeenUsedByUser(context.userId)) {
    return CouponRejection.ALREADY_USED;
  }
  return null;
}

/** Código tal como se guarda (`Coupon.nameEs`): sin espacios y en mayúsculas. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}
