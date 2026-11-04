import { Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../domain/repositories/cart.repository.interface";
import type { ICouponRepository } from "../../domain/repositories/coupon.repository.interface";
import { COUPON_REPOSITORY } from "../../domain/repositories/coupon.repository.interface";
import { CartEntity } from "../../domain/entities/cart.entity";
import { CouponEntity } from "../../domain/entities/coupon.entity";
import { couponRejectionFor } from "../../domain/services/coupon-eligibility";
import { LineItemPricingService } from "./line-item-pricing.service";
import { Lang } from "../../domain/enums/lang.enum";
import { localized } from "../use-cases/catalog/catalog-entry.mapper";
import {
  CartCouponResponseDto,
  CartItemResponseDto,
  CartResponseDto,
} from "../dto/cart/cart-response.dto";
import { buildOrderSummaryWithCoupon } from "../shared/order-summary.config";

interface AppliedCoupon {
  coupon: CouponEntity;
  isValid: boolean;
}

/**
 * Carga el carrito de la empresa y arma la respuesta recalculando precios
 * contra el catálogo actual (el carrito no congela precios). Es el camino
 * común de retorno de todos los use cases del carrito.
 *
 * El cupón aplicado se revalida en cada lectura para `userId` (quien mira el
 * carrito, que es quien confirmaría el pedido): si dejó de aplicar, se
 * devuelve con `isValid: false` y sin descuento, pero sigue en el carrito.
 */
@Injectable()
export class CartViewService {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    private readonly lineItemPricingService: LineItemPricingService,
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
  ) {}

  async build(
    companyId: string,
    userId: string,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    const cart =
      await this.cartRepository.getOrCreateViewByCompanyId(companyId);
    return this.toResponse(cart, userId, lang);
  }

  private async resolveCoupon(
    cart: CartEntity,
    userId: string,
  ): Promise<AppliedCoupon | null> {
    if (!cart.couponId) return null;
    const coupon = await this.couponRepository.findWithUserUsages(
      { id: cart.couponId },
      userId,
    );
    // Borrado entre la lectura del carrito y esta (la FK lo pone a null).
    if (!coupon) return null;
    const rejection = couponRejectionFor(coupon, {
      companyId: cart.companyId,
      userId,
    });
    return { coupon, isValid: rejection === null };
  }

  private async toResponse(
    cart: CartEntity,
    userId: string,
    lang: Lang,
  ): Promise<CartResponseDto> {
    const [pricedItems, applied] = await Promise.all([
      this.lineItemPricingService.priceLines(
        cart.items.map((item) => ({
          productId: item.productId,
          productSizeId: item.productSizeId,
          comboId: item.comboId,
          quantity: item.quantity,
          modifiers: item.modifierIds.map((modifierId) => ({ modifierId })),
        })),
      ),
      this.resolveCoupon(cart, userId),
    ]);

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
      // Mismo orden que las tarjetas del catálogo: por nombre en `lang`.
      itemDto.tags = (display?.tags ?? [])
        .map((tag) => localized(lang, tag.nameEs, tag.nameEn))
        .sort((a, b) => a.localeCompare(b, lang));
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
    dto.summary = buildOrderSummaryWithCoupon(
      pricedItems.map((p) => p.subtotal),
      applied?.isValid ? applied.coupon : null,
    );
    dto.coupon = applied ? toCouponDto(applied) : null;
    // Mismo valor que summary.subtotal (sumado en céntimos).
    dto.subtotal = dto.summary.subtotal;
    dto.totalUnits = totalUnits;
    dto.createdAt = cart.createdAt;
    dto.updatedAt = cart.updatedAt;
    return dto;
  }
}

function toCouponDto({
  coupon,
  isValid,
}: AppliedCoupon): CartCouponResponseDto {
  const dto = new CartCouponResponseDto();
  dto.code = coupon.nameEs;
  dto.discountPercent = coupon.discountPercent;
  dto.isValid = isValid;
  return dto;
}
