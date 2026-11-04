import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  COUPON_FULL_INCLUDE,
  ICouponRepository,
} from "../../domain/repositories/coupon.repository.interface";
import { CouponEntity } from "../../domain/entities/coupon.entity";
import { CouponUnavailableException } from "../../domain/exceptions/coupon-unavailable.exception";

export interface ConsumeCouponParams {
  couponId: string;
  userId: string;
  orderId: string;
  /** Si viene, el cupón debe ser global o de esta empresa. */
  companyId?: string;
}

/**
 * Consume un uso del cupón dentro de la transacción `tx` (la del pedido en el
 * checkout): suma `usedQuantity` con un UPDATE condicionado que revalida en la
 * BD que siga activo, sin vencer, con usos y (si se pasa) de la empresa, y
 * registra el `CouponUsage`. Si no cuadra, o el usuario ya lo usó (unique
 * couponId+userId), lanza `CouponUnavailableException` y el llamador revierte.
 */
export async function consumeCouponWithin(
  tx: Prisma.TransactionClient,
  params: ConsumeCouponParams,
): Promise<void> {
  const updated = await tx.coupon.updateMany({
    where: {
      id: params.couponId,
      isActive: true,
      expiresAt: { gt: new Date() },
      usedQuantity: { lt: tx.coupon.fields.totalQuantity },
      ...(params.companyId
        ? { OR: [{ companyId: null }, { companyId: params.companyId }] }
        : {}),
    },
    data: { usedQuantity: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new CouponUnavailableException(params.couponId);
  }
  try {
    await tx.couponUsage.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        orderId: params.orderId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CouponUnavailableException(params.couponId);
    }
    throw error;
  }
}

@Injectable()
export class CouponRepository implements ICouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: CouponEntity): Promise<CouponEntity> {
    const coupon = await this.prisma.coupon.create({
      data: entity.toPrismaCreate(),
      include: COUPON_FULL_INCLUDE,
    });
    return CouponEntity.fromPrisma(coupon);
  }

  async findUnique(
    args: Prisma.CouponFindUniqueArgs,
  ): Promise<CouponEntity | null> {
    const coupon = await this.prisma.coupon.findUnique(args);
    return coupon ? CouponEntity.fromPrisma(coupon) : null;
  }

  async findMany(
    args?: Prisma.CouponFindManyArgs,
  ): Promise<{ data: CouponEntity[]; total?: number }> {
    const rows = await this.prisma.coupon.findMany(args);
    const data = rows.map((row) => CouponEntity.fromPrisma(row));

    const hasPagination =
      typeof args?.skip === "number" || typeof args?.take === "number";
    if (hasPagination) {
      const total = await this.prisma.coupon.count({ where: args?.where });
      return { data, total };
    }
    return { data };
  }

  async update(args: Prisma.CouponUpdateArgs): Promise<CouponEntity> {
    const coupon = await this.prisma.coupon.update(args);
    return CouponEntity.fromPrisma(coupon);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.coupon.delete({ where: { id } });
  }

  async exists(args: Prisma.CouponCountArgs): Promise<boolean> {
    const count = await this.prisma.coupon.count(args);
    return count > 0;
  }

  async findByName(name: string): Promise<CouponEntity | null> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { nameEs: name },
      include: COUPON_FULL_INCLUDE,
    });
    return coupon ? CouponEntity.fromPrisma(coupon) : null;
  }

  async consumeCoupon(
    couponId: string,
    userId: string,
    orderId: string,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      consumeCouponWithin(tx, { couponId, userId, orderId }),
    );
  }

  async findWithUserUsages(
    where: Prisma.CouponWhereUniqueInput,
    userId: string,
  ): Promise<CouponEntity | null> {
    const coupon = await this.prisma.coupon.findUnique({
      where,
      include: { usages: { where: { userId } } },
    });
    return coupon ? CouponEntity.fromPrisma(coupon) : null;
  }
}
