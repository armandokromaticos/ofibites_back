import { Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import { CartViewService } from "../../services/cart-view.service";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";
import { Lang } from "../../../domain/enums/lang.enum";

@Injectable()
export class ClearCartUseCase {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    const cart = await this.cartRepository.getOrCreateByCompanyId(companyId);
    await this.cartRepository.clear(cart.id);
    return this.cartView.build(companyId, lang);
  }
}
