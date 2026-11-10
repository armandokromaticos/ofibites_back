import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import type { ICouponRepository } from "../../../domain/repositories/coupon.repository.interface";
import { COUPON_REPOSITORY } from "../../../domain/repositories/coupon.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import {
  CouponRejection,
  couponRejectionFor,
  normalizeCouponCode,
} from "../../../domain/services/coupon-eligibility";
import { Lang } from "../../../domain/enums/lang.enum";
import { CartViewService } from "../../services/cart-view.service";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";
import { ApplyCartCouponDto } from "../../dto/cart/apply-cart-coupon.dto";
import { assertCompanyActive } from "../../shared/company-active.guard";

/** Mensajes para el usuario final (los muestra el front tal cual). */
export const CART_COUPON_MESSAGES: Record<CouponRejection, string> = {
  [CouponRejection.NOT_FOUND]: "Ese código no existe.",
  [CouponRejection.NOT_VALID]: "Ese código ya no está vigente.",
  [CouponRejection.OTHER_COMPANY]: "Ese código no aplica a tu empresa.",
  [CouponRejection.ALREADY_USED]: "Ya usaste este código.",
};

export const CART_COUPON_EMPTY_CART_MESSAGE =
  "Agrega productos antes de aplicar un código.";

/**
 * `POST /cart/coupon`: valida el código para el usuario y la empresa del
 * carrito y lo deja aplicado. Reemplaza al cupón anterior si lo había. El
 * descuento no se congela: la vista y el checkout lo recalculan.
 */
@Injectable()
export class ApplyCartCouponUseCase {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    userId: string,
    dto: ApplyCartCouponDto,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    await assertCompanyActive(companyId, {
      companyRepository: this.companyRepository,
    });

    const cart = await this.cartRepository.getOrCreateForUser(
      companyId,
      userId,
    );
    if (cart.items.length === 0) {
      throw new BadRequestException(CART_COUPON_EMPTY_CART_MESSAGE);
    }

    const coupon = await this.couponRepository.findWithUserUsages(
      { nameEs: normalizeCouponCode(dto.code) },
      userId,
    );
    const rejection = couponRejectionFor(coupon, { companyId, userId });
    if (rejection || !coupon?.id) {
      throw new BadRequestException(
        CART_COUPON_MESSAGES[rejection ?? CouponRejection.NOT_FOUND],
      );
    }

    await this.cartRepository.setCoupon(cart.id, coupon.id);
    return this.cartView.build(companyId, userId, lang);
  }
}
