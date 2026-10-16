import { Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../domain/repositories/cart.repository.interface";
import { CartEntity } from "../../domain/entities/cart.entity";
import { LineItemPricingService } from "./line-item-pricing.service";
import { Lang } from "../../domain/enums/lang.enum";
import { localized } from "../use-cases/catalog/catalog-entry.mapper";
import {
  CartItemResponseDto,
  CartResponseDto,
} from "../dto/cart/cart-response.dto";
import { buildOrderSummary } from "../shared/order-summary.config";

/**
 * Carga el carrito de la empresa y arma la respuesta recalculando precios
 * contra el catálogo actual (el carrito no congela precios). Es el camino
 * común de retorno de todos los use cases del carrito.
 */
@Injectable()
export class CartViewService {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    private readonly lineItemPricingService: LineItemPricingService,
  ) {}

  async build(
    companyId: string,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    const cart =
      await this.cartRepository.getOrCreateViewByCompanyId(companyId);
    return this.toResponse(cart, lang);
  }

  private async toResponse(
    cart: CartEntity,
    lang: Lang,
  ): Promise<CartResponseDto> {
    const pricedItems = await Promise.all(
      cart.items.map((item) =>
        this.lineItemPricingService.priceLineItem({
          productId: item.productId,
          productSizeId: item.productSizeId,
          comboId: item.comboId,
          quantity: item.quantity,
          modifiers: item.modifierIds.map((modifierId) => ({ modifierId })),
        }),
      ),
    );

    const items: CartItemResponseDto[] = [];
    let totalUnits = 0;

    cart.items.forEach((item, index) => {
      const priced = pricedItems[index];

      totalUnits += item.quantity;

      const itemDto = new CartItemResponseDto();
      itemDto.id = item.id;
      itemDto.productId = item.productId;
      const display = item.display;
      itemDto.name = display
        ? localized(lang, display.nameEs, display.nameEn)
        : "";
      itemDto.image = display?.image ?? null;
      itemDto.sizeLabel = display?.sizeNameEs
        ? localized(lang, display.sizeNameEs, display.sizeNameEn)
        : null;
      itemDto.servings = display?.servings ?? null;
      itemDto.isAvailable = display?.isAvailable ?? true;
      itemDto.productSizeId = item.productSizeId;
      itemDto.comboId = item.comboId;
      itemDto.quantity = item.quantity;
      itemDto.unitPrice = priced.unitPrice;
      itemDto.subtotal = priced.subtotal;
      itemDto.addedById = item.addedById;
      itemDto.modifiers = priced.modifiers.map((modifier) => ({
        modifierId: modifier.modifierId,
        priceAdjustment: modifier.priceAdjustment,
      }));
      items.push(itemDto);
    });

    const dto = new CartResponseDto();
    dto.id = cart.id;
    dto.companyId = cart.companyId;
    dto.items = items;
    dto.summary = buildOrderSummary(pricedItems.map((p) => p.subtotal));
    // Mismo valor que summary.subtotal (sumado en céntimos).
    dto.subtotal = dto.summary.subtotal;
    dto.totalUnits = totalUnits;
    dto.createdAt = cart.createdAt;
    dto.updatedAt = cart.updatedAt;
    return dto;
  }
}
