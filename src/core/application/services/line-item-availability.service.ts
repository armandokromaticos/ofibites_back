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
import type { ProductEntity } from "../../domain/entities/product.entity";
import type { ComboEntity } from "../../domain/entities/combo.entity";
import type { ProductSizeEntity } from "../../domain/entities/product-size.entity";
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
  PricedLineItem,
} from "./line-item-pricing.service";

/** 404 del pricing → NOT_FOUND, cualquier otro 4xx → CONFIGURATION; otro error se relanza. */
function pricingErrorCode(error: unknown): LineAvailabilityCode {
  if (error instanceof NotFoundException) return "NOT_FOUND";
  if (error instanceof HttpException) return "CONFIGURATION";
  throw error;
}

/**
 * Lo mismo que `resolveUnavailabilityCode` con la regla y la cotización de la
 * línea ya calculadas (en lote): sin consultas.
 */
export function unavailabilityCodeOf(
  issue: LineAvailabilityIssue | null,
  quote: PromiseSettledResult<PricedLineItem>,
): LineAvailabilityCode | null {
  if (issue) return issue.code;
  return quote.status === "rejected" ? pricingErrorCode(quote.reason) : null;
}

/**
 * Motivo por el que una línea **ya guardada** (carrito o pedido) no se puede
 * pedir hoy, o null. El `code` sale de la regla única; `priceLineItem` queda
 * como red de seguridad (p. ej. el producto ancla de un combo que ya no
 * existe, que la regla no mira): su 404 → NOT_FOUND y cualquier otro 4xx →
 * CONFIGURATION, por tipo de excepción, sin leer mensajes. Lo usa "repetir en
 * el carrito"; el checkout, en lote, `unavailabilityCodeOf`.
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
    return pricingErrorCode(error);
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
    await this.assertAvailableMany([input]);
  }

  /** Como `assertAvailable` para varias líneas: el 400 es el de la primera que falle. */
  async assertAvailableMany(inputs: LineItemInput[]): Promise<void> {
    for (const found of await this.checkMany(inputs)) {
      if (found && found.code !== "NOT_FOUND") {
        throw new BadRequestException(found.message);
      }
    }
  }

  /** Devuelve el primer problema de la línea (con su `code`) o null. */
  async check(input: LineItemInput): Promise<LineAvailabilityIssue | null> {
    const [found] = await this.checkMany([input]);
    return found;
  }

  /** `check` de varias líneas con un número fijo de consultas, en el mismo orden. */
  async checkMany(
    inputs: LineItemInput[],
  ): Promise<(LineAvailabilityIssue | null)[]> {
    const snapshots = await this.loadSnapshots(inputs);
    return snapshots.map(evaluateLineAvailability);
  }

  private async loadSnapshots(
    inputs: LineItemInput[],
  ): Promise<LineAvailabilitySnapshot[]> {
    const lines = inputs.map((input) => ({
      productId: input.productId,
      productSizeId: input.productSizeId ?? null,
      comboId: input.comboId ?? null,
      modifierIds: (input.modifiers ?? []).map((m) => m.modifierId),
    }));

    const productIds = new Set<string>();
    const comboIds = new Set<string>();
    const sizeIds = new Set<string>();
    const modifierIds = new Set<string>();
    const pricedSizeIds = new Set<string>();
    for (const line of lines) {
      if (line.comboId) {
        // Sin consultas si ya falla por configuración.
        if (!line.productSizeId && line.modifierIds.length === 0) {
          comboIds.add(line.comboId);
        }
        continue;
      }
      productIds.add(line.productId);
      if (line.productSizeId) sizeIds.add(line.productSizeId);
      for (const id of line.modifierIds) modifierIds.add(id);
      if (line.productSizeId && line.modifierIds.length > 0) {
        pricedSizeIds.add(line.productSizeId);
      }
    }
    const ids = (set: Set<string>) => ({ in: [...set] });

    // Todo en un viaje: los grupos se piden por "contienen alguno de los
    // modificadores", que es el mismo conjunto que por sus groupId.
    const [
      { data: combos },
      { data: products },
      { data: sizes },
      { data: modifierRows },
      { data: groups },
      sizePrices,
    ] = await Promise.all([
      comboIds.size > 0
        ? this.comboRepository.findMany({
            where: { id: ids(comboIds) },
            include: COMBO_FULL_INCLUDE,
          })
        : { data: [] as ComboEntity[] },
      productIds.size > 0
        ? this.productRepository.findMany({
            where: { id: ids(productIds) },
            include: { sizes: { where: { isActive: true } } },
          })
        : { data: [] as ProductEntity[] },
      sizeIds.size > 0
        ? this.productSizeRepository.findMany({ where: { id: ids(sizeIds) } })
        : { data: [] as ProductSizeEntity[] },
      modifierIds.size > 0
        ? this.productModifierRepository.findMany({
            where: { id: ids(modifierIds) },
          })
        : { data: [] as ProductModifierEntity[] },
      modifierIds.size > 0
        ? this.productModifierGroupRepository.findMany({
            where: { modifiers: { some: { id: ids(modifierIds) } } },
          })
        : { data: [] as ProductModifierGroupEntity[] },
      pricedSizeIds.size > 0
        ? this.productModifierRepository.findSizePricesBatch(
            [...modifierIds],
            [...pricedSizeIds],
          )
        : new Map<string, Map<string, number>>(),
    ]);

    const combosById = new Map(combos.map((c) => [c.id, c] as const));
    const productsById = new Map(products.map((p) => [p.id, p] as const));
    const sizesById = new Map(sizes.map((s) => [s.id, s] as const));
    const modifiersById = new Map(modifierRows.map((m) => [m.id, m] as const));
    const groupProduct = new Map(groups.map((g) => [g.id, g.productId]));

    return lines.map((line): LineAvailabilitySnapshot => {
      if (line.comboId) {
        if (line.productSizeId || line.modifierIds.length > 0) {
          return { line };
        }
        const combo = combosById.get(line.comboId);
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

      const product = productsById.get(line.productId);
      const size = line.productSizeId
        ? sizesById.get(line.productSizeId)
        : undefined;
      const sizePriced = line.productSizeId
        ? sizePrices.get(line.productSizeId)
        : undefined;
      const modifiers: LineAvailabilitySnapshot["modifiers"] = [];
      for (const id of new Set(line.modifierIds)) {
        const m = modifiersById.get(id);
        if (!m) continue;
        modifiers.push({
          id: m.id,
          isActive: m.isActive,
          groupProductId: groupProduct.get(m.groupId) ?? null,
          sizeRestricted: m.sizeRestricted,
          pricedSizeIds:
            line.productSizeId && sizePriced?.has(m.id)
              ? [line.productSizeId]
              : [],
        });
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
    });
  }
}
