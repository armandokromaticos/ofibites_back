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
import {
  LINE_CONCURRENCY,
  mapWithConcurrency,
} from "../shared/map-with-concurrency.util";
import type { ProductModifierEntity } from "../../domain/entities/product-modifier.entity";
import type { ProductModifierGroupEntity } from "../../domain/entities/product-modifier-group.entity";

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

    const inputModifiers = input.modifiers ?? [];
    const modifierIds = inputModifiers.map((modifier) => modifier.modifierId);
    // Lecturas independientes en paralelo (un viaje a la BD en vez de hasta
    // cinco); las validaciones de abajo conservan su orden y sus errores.
    const [
      product,
      combo,
      size,
      sizePricesMap,
      { data: modifierList },
      { data: groupList },
    ] = await Promise.all([
      this.productRepository.findUnique({ where: { id: input.productId } }),
      input.comboId
        ? this.comboRepository.findUnique({ where: { id: input.comboId } })
        : null,
      !input.comboId && input.productSizeId
        ? this.productSizeRepository.findUnique({
            where: { id: input.productSizeId },
          })
        : null,
      inputModifiers.length > 0 && input.productSizeId
        ? this.productModifierRepository.findSizePricesBatch(
            modifierIds,
            input.productSizeId,
          )
        : new Map<string, number>(),
      inputModifiers.length > 0
        ? this.productModifierRepository.findMany({
            where: { id: { in: modifierIds } },
          })
        : { data: [] as ProductModifierEntity[] },
      // Los grupos de esos modificadores (mismo conjunto que por groupId).
      inputModifiers.length > 0
        ? this.productModifierGroupRepository.findMany({
            where: { modifiers: { some: { id: { in: modifierIds } } } },
          })
        : { data: [] as ProductModifierGroupEntity[] },
    ]);
    if (!product) {
      throw new NotFoundException(
        `Product with id ${input.productId} not found`,
      );
    }

    let unitPrice: number;

    if (input.comboId) {
      if (!combo) {
        throw new NotFoundException(`Combo with id ${input.comboId} not found`);
      }
      unitPrice = combo.price;
    } else if (input.productSizeId) {
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

    if (inputModifiers.length > 0) {
      // Batch para evitar N+1: un findMany de modifiers y otro de sus groups.
      const modifiersById = new Map(
        modifierList.map((modifier) => [modifier.id, modifier] as const),
      );
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
    const priced = await mapWithConcurrency(inputs, LINE_CONCURRENCY, (input) =>
      this.priceLineItem(input),
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
