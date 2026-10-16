import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../domain/repositories/product.repository.interface";
import type { IProductSizeRepository } from "../../domain/repositories/product-size.repository.interface";
import { PRODUCT_SIZE_REPOSITORY } from "../../domain/repositories/product-size.repository.interface";
import type { IProductModifierRepository } from "../../domain/repositories/product-modifier.repository.interface";
import { PRODUCT_MODIFIER_REPOSITORY } from "../../domain/repositories/product-modifier.repository.interface";
import type { IComboRepository } from "../../domain/repositories/combo.repository.interface";
import {
  COMBO_FULL_INCLUDE,
  COMBO_REPOSITORY,
} from "../../domain/repositories/combo.repository.interface";
import type { LineItemInput } from "./line-item-pricing.service";

/**
 * Reglas de disponibilidad para **añadir** una línea (carrito) o **crear** una
 * orden. Va aparte de `LineItemPricingService` a propósito: `GET /cart`
 * recotiza líneas viejas con ese servicio y no debe romperse si algo del
 * catálogo se desactiva después (misma regla que `repeat-order`: un combo se
 * rige por su propio `isActive`, no por el del producto ancla).
 *
 * Si una entidad no existe, no lanza: lo hace `priceLineItem` (404).
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
    @Inject(COMBO_REPOSITORY)
    private readonly comboRepository: IComboRepository,
  ) {}

  async assertAvailable(input: LineItemInput): Promise<void> {
    const modifierIds = (input.modifiers ?? []).map((m) => m.modifierId);

    if (input.comboId) {
      if (modifierIds.length > 0) {
        throw new BadRequestException(
          "Los combos no admiten modificadores: envía modifiers vacío u omítelo",
        );
      }
      const combo = await this.comboRepository.findUnique({
        where: { id: input.comboId },
        include: COMBO_FULL_INCLUDE,
      });
      if (!combo) return;
      if (!combo.isActive) {
        throw new BadRequestException(
          `El combo ${input.comboId} no está disponible`,
        );
      }
      const belongs = (combo.items ?? []).some(
        (item) => item.productId === input.productId,
      );
      if (!belongs) {
        throw new BadRequestException(
          `El producto ${input.productId} no forma parte del combo ${input.comboId}`,
        );
      }
      return;
    }

    const product = await this.productRepository.findUnique({
      where: { id: input.productId },
      include: { sizes: { where: { isActive: true } } },
    });
    if (!product) return;
    if (!product.isActive) {
      throw new BadRequestException(
        `El producto ${input.productId} no está disponible`,
      );
    }

    if (input.productSizeId) {
      const size = await this.productSizeRepository.findUnique({
        where: { id: input.productSizeId },
      });
      if (size && !size.isActive) {
        throw new BadRequestException(
          `El tamaño ${input.productSizeId} no está disponible`,
        );
      }
    } else if ((product.sizes ?? []).some((size) => size.isActive)) {
      throw new BadRequestException(
        `El producto ${input.productId} tiene tamaños: indica productSizeId`,
      );
    }

    if (modifierIds.length > 0) {
      const { data: modifiers } = await this.productModifierRepository.findMany(
        { where: { id: { in: modifierIds } } },
      );
      const inactive = modifiers.find((modifier) => !modifier.isActive);
      if (inactive) {
        throw new BadRequestException(
          `El modificador ${inactive.id} no está disponible`,
        );
      }
    }
  }
}
