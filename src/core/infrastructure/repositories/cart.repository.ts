import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import {
  AddCartItemParams,
  CART_FULL_INCLUDE,
  CART_ITEMS_INCLUDE,
  ICartRepository,
} from "../../domain/repositories/cart.repository.interface";
import {
  CartEntity,
  findMatchingCartItem,
} from "../../domain/entities/cart.entity";

function toCartItemCreate(
  cartId: string,
  params: AddCartItemParams,
): Prisma.CartItemCreateInput {
  return {
    cart: { connect: { id: cartId } },
    product: { connect: { id: params.productId } },
    productSize: params.productSizeId
      ? { connect: { id: params.productSizeId } }
      : undefined,
    combo: params.comboId ? { connect: { id: params.comboId } } : undefined,
    addedBy: params.addedById
      ? { connect: { id: params.addedById } }
      : undefined,
    quantity: params.quantity,
    modifiers: {
      create: params.modifierIds.map((modifierId) => ({
        modifier: { connect: { id: modifierId } },
      })),
    },
  };
}

@Injectable()
export class CartRepository implements ICartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateByCompanyId(companyId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
      include: CART_ITEMS_INCLUDE,
    });
    return CartEntity.fromPrisma(cart);
  }

  async getOrCreateViewByCompanyId(companyId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
      include: CART_FULL_INCLUDE,
    });
    return CartEntity.fromPrisma(cart);
  }

  async findByCompanyId(companyId: string): Promise<CartEntity | null> {
    const cart = await this.prisma.cart.findUnique({
      where: { companyId },
      include: CART_ITEMS_INCLUDE,
    });
    return cart ? CartEntity.fromPrisma(cart) : null;
  }

  async addItem(cartId: string, params: AddCartItemParams): Promise<void> {
    await this.prisma.cartItem.create({
      data: toCartItemCreate(cartId, params),
    });
  }

  async addItemsAtomically(
    companyId: string,
    lines: AddCartItemParams[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { companyId },
        create: { companyId },
        update: {},
        include: { items: { include: { modifiers: true } } },
      });

      // Líneas actuales + las creadas en esta misma transacción, para que dos
      // líneas iguales del pedido acaben sumadas en una sola.
      const known = cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        modifierIds: item.modifiers.map((m) => m.modifierId),
      }));

      for (const line of lines) {
        const existing = findMatchingCartItem(known, line);
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: line.quantity } },
          });
          continue;
        }
        const created = await tx.cartItem.create({
          data: toCartItemCreate(cart.id, line),
          select: { id: true },
        });
        known.push({
          id: created.id,
          productId: line.productId,
          productSizeId: line.productSizeId ?? null,
          comboId: line.comboId ?? null,
          modifierIds: line.modifierIds,
        });
      }
    });
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<void> {
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  async incrementItemQuantity(itemId: string, delta: number): Promise<void> {
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: { increment: delta } },
    });
  }

  async removeItem(itemId: string): Promise<void> {
    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clear(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }
}
