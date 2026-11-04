import { Prisma } from "@prisma/client";
import { CouponEntity } from "../entities/coupon.entity";

export const COUPON_REPOSITORY = Symbol("COUPON_REPOSITORY");

export const COUPON_FULL_INCLUDE = {
  usages: true,
} as const satisfies Prisma.CouponInclude;

export interface ICouponRepository {
  create(entity: CouponEntity): Promise<CouponEntity>;
  findUnique(args: Prisma.CouponFindUniqueArgs): Promise<CouponEntity | null>;
  findMany(
    args?: Prisma.CouponFindManyArgs,
  ): Promise<{ data: CouponEntity[]; total?: number }>;
  update(args: Prisma.CouponUpdateArgs): Promise<CouponEntity>;
  delete(id: string): Promise<void>;
  exists(args: Prisma.CouponCountArgs): Promise<boolean>;

  // Helpers de dominio
  findByName(name: string): Promise<CouponEntity | null>;
  /**
   * Cupón con `usages` limitados a los de `userId` (basta para
   * `hasBeenUsedByUser` sin cargar todos los usos de un cupón GLOBAL).
   */
  findWithUserUsages(
    where: Prisma.CouponWhereUniqueInput,
    userId: string,
  ): Promise<CouponEntity | null>;
  consumeCoupon(
    couponId: string,
    userId: string,
    orderId: string,
  ): Promise<void>;
}
