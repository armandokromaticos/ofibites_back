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
import type { ProductEntity } from "../../domain/entities/product.entity";
import type { ComboEntity } from "../../domain/entities/combo.entity";
import type { ProductSizeEntity } from "../../domain/entities/product-size.entity";
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

/** Catálogo leído de la BD para cotizar un lote de líneas (por id). */
interface PricingCatalog {
  products: Map<string, ProductEntity>;
  combos: Map<string | undefined, ComboEntity>;
  sizes: Map<string, ProductSizeEntity>;
  /** tamaño → modificador → precio propio del modificador en ese tamaño. */
  sizePrices: Map<string, Map<string, number>>;
  modifiers: Map<string, ProductModifierEntity>;
  groups: Map<string, ProductModifierGroupEntity>;
}

function byId<K, T extends { id: K }>(rows: T[]): Map<K, T> {
  return new Map(rows.map((row) => [row.id, row] as const));
}

/** Líneas cotizadas listas para `OrderEntity.fromCreateDto` (precio congelado). */
export function toOrderItems(
  inputs: LineItemInput[],
  priced: PricedLineItem[],
): CreateOrderItemParams[] {
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

/**
 * Valida y cotiza líneas (producto + tamaño/combo + modificadores) contra el
 * catálogo actual. Lo usan tanto la creación de órdenes (precio congelado en la
 * orden) como el carrito (recalculado en cada lectura). Lee siempre de la BD:
 * el precio nunca sale de una caché.
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
    const [priced] = await this.priceLines([input]);
    return priced;
  }

  /**
   * Cotiza todas las líneas con un número fijo de consultas (sea cual sea N).
   * Si varias fallan, lanza el error de la primera en el orden de entrada.
   */
  async priceLines(inputs: LineItemInput[]): Promise<PricedLineItem[]> {
    const results = await this.priceLinesSettled(inputs);
    return results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
  }

  /**
   * Como `priceLines`, pero sin lanzar por línea: un resultado por línea, en
   * el mismo orden. Un error de la BD sí se propaga.
   */
  async priceLinesSettled(
    inputs: LineItemInput[],
  ): Promise<PromiseSettledResult<PricedLineItem>[]> {
    if (inputs.length === 0) return [];
    const catalog = await this.loadCatalog(inputs);
    return inputs.map((input) => {
      try {
        return {
          status: "fulfilled" as const,
          value: this.priceFromCatalog(input, catalog),
        };
      } catch (reason: unknown) {
        return { status: "rejected" as const, reason };
      }
    });
  }

  /**
   * Cotiza varias líneas y las deja listas para `OrderEntity.fromCreateDto`
   * (precio congelado en el pedido). Lo usa `POST /orders`.
   */
  async priceOrderLines(
    inputs: LineItemInput[],
  ): Promise<CreateOrderItemParams[]> {
    return toOrderItems(inputs, await this.priceLines(inputs));
  }

  /** Seis lecturas independientes en paralelo, con `in` sobre los ids de todas las líneas. */
  private async loadCatalog(inputs: LineItemInput[]): Promise<PricingCatalog> {
    const productIds = new Set<string>();
    const comboIds = new Set<string>();
    const sizeIds = new Set<string>();
    const modifierIds = new Set<string>();
    const pricedSizeIds = new Set<string>();
    for (const input of inputs) {
      productIds.add(input.productId);
      const inputModifiers = input.modifiers ?? [];
      if (input.comboId) comboIds.add(input.comboId);
      else if (input.productSizeId) sizeIds.add(input.productSizeId);
      for (const modifier of inputModifiers)
        modifierIds.add(modifier.modifierId);
      if (inputModifiers.length > 0 && input.productSizeId) {
        pricedSizeIds.add(input.productSizeId);
      }
    }
    const ids = (set: Set<string>) => ({ in: [...set] });

    const [
      { data: products },
      { data: combos },
      { data: sizes },
      sizePrices,
      { data: modifiers },
      { data: groups },
    ] = await Promise.all([
      this.productRepository.findMany({ where: { id: ids(productIds) } }),
      comboIds.size > 0
        ? this.comboRepository.findMany({ where: { id: ids(comboIds) } })
        : { data: [] as ComboEntity[] },
      sizeIds.size > 0
        ? this.productSizeRepository.findMany({ where: { id: ids(sizeIds) } })
        : { data: [] as ProductSizeEntity[] },
      pricedSizeIds.size > 0
        ? this.productModifierRepository.findSizePricesBatch(
            [...modifierIds],
            [...pricedSizeIds],
          )
        : new Map<string, Map<string, number>>(),
      modifierIds.size > 0
        ? this.productModifierRepository.findMany({
            where: { id: ids(modifierIds) },
          })
        : { data: [] as ProductModifierEntity[] },
      // Los grupos de esos modificadores (mismo conjunto que por groupId, sin
      // esperar a leer los modificadores).
      modifierIds.size > 0
        ? this.productModifierGroupRepository.findMany({
            where: { modifiers: { some: { id: ids(modifierIds) } } },
          })
        : { data: [] as ProductModifierGroupEntity[] },
    ]);

    return {
      products: byId(products),
      combos: byId(combos),
      sizes: byId(sizes),
      sizePrices,
      modifiers: byId(modifiers),
      groups: byId(groups),
    };
  }

  /** Validaciones y errores de una línea, en memoria sobre el catálogo leído. */
  private priceFromCatalog(
    input: LineItemInput,
    catalog: PricingCatalog,
  ): PricedLineItem {
    if (input.comboId && input.productSizeId) {
      throw new BadRequestException(
        "comboId and productSizeId cannot both be provided",
      );
    }

    const inputModifiers = input.modifiers ?? [];
    const product = catalog.products.get(input.productId);
    if (!product) {
      throw new NotFoundException(
        `Product with id ${input.productId} not found`,
      );
    }

    let unitPrice: number;

    if (input.comboId) {
      const combo = catalog.combos.get(input.comboId);
      if (!combo) {
        throw new NotFoundException(`Combo with id ${input.comboId} not found`);
      }
      unitPrice = combo.price;
    } else if (input.productSizeId) {
      const size = catalog.sizes.get(input.productSizeId);
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
      const sizePricesMap =
        (input.productSizeId
          ? catalog.sizePrices.get(input.productSizeId)
          : undefined) ?? new Map<string, number>();

      for (const modInput of inputModifiers) {
        const modifier = catalog.modifiers.get(modInput.modifierId);
        if (!modifier) {
          throw new NotFoundException(
            `ProductModifier with id ${modInput.modifierId} not found`,
          );
        }
        const group = catalog.groups.get(modifier.groupId);
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
}
