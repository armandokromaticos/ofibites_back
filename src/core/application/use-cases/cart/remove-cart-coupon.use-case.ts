import { Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import { Lang } from "../../../domain/enums/lang.enum";
import { CartViewService } from "../../services/cart-view.service";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";

/** `DELETE /cart/coupon`: quita el cupón del carrito. Idempotente. */
@Injectable()
export class RemoveCartCouponUseCase {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    userId: string,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    const cart = await this.cartRepository.getOrCreateByCompanyId(companyId);
    if (cart.couponId) {
      await this.cartRepository.setCoupon(cart.id, null);
    }
    return this.cartView.build(companyId, userId, lang);
  }
}
