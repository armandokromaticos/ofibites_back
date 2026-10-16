import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { CartViewService } from "../../services/cart-view.service";
import { assertCompanyActive } from "../../shared/company-active.guard";
import { UpdateCartItemDto } from "../../dto/cart/update-cart-item.dto";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";
import { Lang } from "../../../domain/enums/lang.enum";

@Injectable()
export class UpdateCartItemUseCase {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    itemId: string,
    dto: UpdateCartItemDto,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    await assertCompanyActive(companyId, {
      companyRepository: this.companyRepository,
    });

    const cart = await this.cartRepository.getOrCreateByCompanyId(companyId);
    const item = cart.items.find((cartItem) => cartItem.id === itemId);
    if (!item) {
      throw new NotFoundException(
        `Cart item ${itemId} not found in this company's cart`,
      );
    }

    await this.cartRepository.updateItemQuantity(itemId, dto.quantity);
    return this.cartView.build(companyId, lang);
  }
}
