import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../domain/repositories/product.repository.interface";
import type { IProductSizeRepository } from "../../domain/repositories/product-size.repository.interface";
import { PRODUCT_SIZE_REPOSITORY } from "../../domain/repositories/product-size.repository.interface";
import type { IProductModifierRepository } from "../../domain/repositories/product-modifier.repository.interface";
import { PRODUCT_MODIFIER_REPOSITORY } from "../../domain/repositories/product-modifier.repository.interface";
import type { IProductModifierGroupRepository } from "../../domain/repositories/product-modifier-group.repository.interface";
import { PRODUCT_MODIFIER_GROUP_REPOSITORY } from "../../domain/repositories/product-modifier-group.repository.interface";
import type { IComboRepository } from "../../domain/repositories/combo.repository.interface";
import { COMBO_REPOSITORY } from "../../domain/repositories/combo.repository.interface";
import type { CreateOrderItemParams } from "../../domain/entities/order.entity";

export interface LineItemInput {
  productId: string;
  productSizeId?: string | null;
  comboId?: string | null;
  quantity: number;
  modifiers?: { modifierId: string }[];
}

export interface PricedModifier {
  modifierId: string;
  priceAdjustment: number;
}

export interface PricedLineItem {
  unitPrice: number;
  subtotal: number;
  modifiers: PricedModifier[];
}

/**
 * Valida y cotiza una línea (producto + tamaño/combo + modificadores) contra el
 * catálogo actual. Lo usan tanto la creación de órdenes (precio congelado en la
 * orden) como el carrito (recalculado en cada lectura).
 */
@Injectable()
export class LineItemPricingService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_SIZE_REPOSITORY)
    private readonly productSizeRepository: IProductSizeRepository,
    @Inject(PRODUCT_MODIFIER_REPOSITORY)
    private readonly productModifierRepository: IProductModifierRepository,
    @Inject(PRODUCT_MODIFIER_GROUP_REPOSITORY)
    private readonly productModifierGroupRepository: IProductModifierGroupRepository,
    @Inject(COMBO_REPOSITORY)
    private readonly comboRepository: IComboRepository,
  ) {}

  async priceLineItem(input: LineItemInput): Promise<PricedLineItem> {
    if (input.comboId && input.productSizeId) {
      throw new BadRequestException(
        "comboId and productSizeId cannot both be provided",
      );
    }

    const product = await this.productRepository.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with id ${input.productId} not found`,
      );
    }

    let unitPrice: number;

    if (input.comboId) {
      const combo = await this.comboRepository.findUnique({
        where: { id: input.comboId },
      });
      if (!combo) {
        throw new NotFoundException(`Combo with id ${input.comboId} not found`);
      }
      unitPrice = combo.price;
    } else if (input.productSizeId) {
      const size = await this.productSizeRepository.findUnique({
        where: { id: input.productSizeId },
      });
      if (!size) {
        throw new NotFoundException(
          `ProductSize with id ${input.productSizeId} not found`,
        );
      }
      if (size.productId !== input.productId) {
        throw new BadRequestException(
          `ProductSize ${input.productSizeId} does not belong to product ${input.productId}`,
        );
      }
      unitPrice = size.price;
    } else {
      unitPrice = product.basePrice;
    }

    const modifiers: PricedModifier[] = [];
    let modifierTotal = 0;

    const inputModifiers = input.modifiers ?? [];
    if (inputModifiers.length > 0) {
      const modifierIds = inputModifiers.map((modifier) => modifier.modifierId);
      const sizePricesMap = input.productSizeId
        ? await this.productModifierRepository.findSizePricesBatch(
            modifierIds,
            input.productSizeId,
          )
        : new Map<string, number>();

      // Batch para evitar N+1: un findMany de modifiers y otro de sus groups.
      const { data: modifierList } =
        await this.productModifierRepository.findMany({
          where: { id: { in: modifierIds } },
        });
      const modifiersById = new Map(
        modifierList.map((modifier) => [modifier.id, modifier] as const),
      );

      const groupIds = [
        ...new Set(modifierList.map((modifier) => modifier.groupId)),
      ];
      const { data: groupList } =
        await this.productModifierGroupRepository.findMany({
          where: { id: { in: groupIds } },
        });
      const groupsById = new Map(
        groupList.map((group) => [group.id, group] as const),
      );

      for (const modInput of inputModifiers) {
        const modifier = modifiersById.get(modInput.modifierId);
        if (!modifier) {
          throw new NotFoundException(
            `ProductModifier with id ${modInput.modifierId} not found`,
          );
        }
        const group = groupsById.get(modifier.groupId);
        if (!group || group.productId !== input.productId) {
          throw new BadRequestException(
            `ProductModifier ${modInput.modifierId} does not belong to product ${input.productId}`,
          );
        }
        if (modifier.sizeRestricted && input.productSizeId) {
          if (!sizePricesMap.has(modInput.modifierId)) {
            throw new BadRequestException(
              `Modifier ${modInput.modifierId} is not available for the selected size`,
            );
          }
        }
        const adj =
          sizePricesMap.get(modInput.modifierId) ?? modifier.priceAdjustment;
        modifierTotal += adj;
        modifiers.push({
          modifierId: modInput.modifierId,
          priceAdjustment: adj,
        });
      }
    }

    const subtotal =
      Math.round((unitPrice + modifierTotal) * input.quantity * 100) / 100;

    return { unitPrice, subtotal, modifiers };
  }

  /**
   * Cotiza varias líneas y las deja listas para `OrderEntity.fromCreateDto`
   * (precio congelado en el pedido). Lo comparten `POST /orders` y el checkout.
   */
  async priceOrderLines(
    inputs: LineItemInput[],
  ): Promise<CreateOrderItemParams[]> {
    const priced = await Promise.all(
      inputs.map((input) => this.priceLineItem(input)),
    );
    return inputs.map((input, index) => ({
      productId: input.productId,
      productSizeId: input.productSizeId ?? undefined,
      comboId: input.comboId ?? undefined,
      quantity: input.quantity,
      unitPrice: priced[index].unitPrice,
      subtotal: priced[index].subtotal,
      modifiers: priced[index].modifiers,
    }));
  }
}
