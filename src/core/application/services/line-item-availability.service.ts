import {
  BadRequestException,
  HttpException,
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
import type { ProductModifierEntity } from "../../domain/entities/product-modifier.entity";
import type { ProductModifierGroupEntity } from "../../domain/entities/product-modifier-group.entity";
import type { IComboRepository } from "../../domain/repositories/combo.repository.interface";
import {
  COMBO_FULL_INCLUDE,
  COMBO_REPOSITORY,
} from "../../domain/repositories/combo.repository.interface";
import {
  evaluateLineAvailability,
  LineAvailabilityCode,
  LineAvailabilityIssue,
  LineAvailabilitySnapshot,
} from "../../domain/services/line-availability";
import type {
  LineItemInput,
  LineItemPricingService,
} from "./line-item-pricing.service";

/**
 * Motivo por el que una línea **ya guardada** (carrito o pedido) no se puede
 * pedir hoy, o null. El `code` sale de la regla única; `priceLineItem` queda
 * como red de seguridad (p. ej. el producto ancla de un combo que ya no
 * existe, que la regla no mira): su 404 → NOT_FOUND y cualquier otro 4xx →
 * CONFIGURATION, por tipo de excepción, sin leer mensajes. Lo usan "repetir en
 * el carrito" y el checkout.
 */
export async function resolveUnavailabilityCode(
  availability: Pick<LineItemAvailabilityService, "check">,
  pricing: Pick<LineItemPricingService, "priceLineItem">,
  input: LineItemInput,
): Promise<LineAvailabilityCode | null> {
  const found = await availability.check(input);
  if (found) return found.code;
  try {
    await pricing.priceLineItem(input);
    return null;
  } catch (error) {
    if (error instanceof NotFoundException) return "NOT_FOUND";
    if (error instanceof HttpException) return "CONFIGURATION";
    throw error;
  }
}

/**
 * Reglas de disponibilidad para **añadir** una línea (carrito), **crear** una
 * orden o **repetir** un pedido en el carrito. Carga los datos y aplica la
 * regla única `evaluateLineAvailability` (la misma que usa `isAvailable` de
 * `GET /cart`). Va aparte de `LineItemPricingService` a propósito: `GET /cart`
 * recotiza líneas viejas con ese servicio y no debe romperse si algo del
 * catálogo se desactiva después (un combo se rige por su propio `isActive`).
 */
@Injectable()
export class LineItemAvailabilityService {
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

  /**
   * 400 en español si la línea no se puede añadir. Si algo no existe no
   * lanza: el 404 lo da `priceLineItem`, como hasta ahora.
   */
  async assertAvailable(input: LineItemInput): Promise<void> {
    const found = await this.check(input);
    if (found && found.code !== "NOT_FOUND") {
      throw new BadRequestException(found.message);
    }
  }

  /** Devuelve el primer problema de la línea (con su `code`) o null. */
  async check(input: LineItemInput): Promise<LineAvailabilityIssue | null> {
    return evaluateLineAvailability(await this.loadSnapshot(input));
  }

  private async loadSnapshot(
    input: LineItemInput,
  ): Promise<LineAvailabilitySnapshot> {
    const line = {
      productId: input.productId,
      productSizeId: input.productSizeId ?? null,
      comboId: input.comboId ?? null,
      modifierIds: (input.modifiers ?? []).map((m) => m.modifierId),
    };

    if (line.comboId) {
      // Sin consultas si ya falla por configuración.
      if (line.productSizeId || line.modifierIds.length > 0) {
        return { line };
      }
      const combo = await this.comboRepository.findUnique({
        where: { id: line.comboId },
        include: COMBO_FULL_INCLUDE,
      });
      return {
        line,
        combo: combo
          ? {
              isActive: combo.isActive,
              productIds: (combo.items ?? []).map((item) => item.productId),
            }
          : null,
      };
    }

    const hasModifiers = line.modifierIds.length > 0;
    // Todo en un viaje: los grupos se piden por "contienen alguno de los
    // modificadores", que es el mismo conjunto que por sus groupId.
    const [product, size, { data }, { data: groups }, sizePrices] =
      await Promise.all([
        this.productRepository.findUnique({
          where: { id: line.productId },
          include: { sizes: { where: { isActive: true } } },
        }),
        line.productSizeId
          ? this.productSizeRepository.findUnique({
              where: { id: line.productSizeId },
            })
          : null,
        hasModifiers
          ? this.productModifierRepository.findMany({
              where: { id: { in: line.modifierIds } },
            })
          : { data: [] as ProductModifierEntity[] },
        hasModifiers
          ? this.productModifierGroupRepository.findMany({
              where: { modifiers: { some: { id: { in: line.modifierIds } } } },
            })
          : { data: [] as ProductModifierGroupEntity[] },
        hasModifiers && line.productSizeId
          ? this.productModifierRepository.findSizePricesBatch(
              line.modifierIds,
              line.productSizeId,
            )
          : new Map<string, number>(),
      ]);

    let modifiers: LineAvailabilitySnapshot["modifiers"] = [];
    if (hasModifiers) {
      const groupProduct = new Map(groups.map((g) => [g.id, g.productId]));
      modifiers = data.map((m) => ({
        id: m.id,
        isActive: m.isActive,
        groupProductId: groupProduct.get(m.groupId) ?? null,
        sizeRestricted: m.sizeRestricted,
        pricedSizeIds:
          line.productSizeId && sizePrices.has(m.id)
            ? [line.productSizeId]
            : [],
      }));
    }

    return {
      line,
      product: product
        ? {
            isActive: product.isActive,
            hasActiveSizes: (product.sizes ?? []).some((s) => s.isActive),
          }
        : null,
      size: line.productSizeId
        ? size
          ? { productId: size.productId, isActive: size.isActive }
          : null
        : undefined,
      modifiers,
    };
  }
}
