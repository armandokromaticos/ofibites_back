import { Inject, Injectable } from "@nestjs/common";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { LineItemPricingService } from "../../services/line-item-pricing.service";
import { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import { CartViewService } from "../../services/cart-view.service";
import { assertCompanyActive } from "../../shared/company-active.guard";
import { AddCartItemDto } from "../../dto/cart/add-cart-item.dto";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";

@Injectable()
export class AddCartItemUseCase {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly lineItemPricingService: LineItemPricingService,
    private readonly lineItemAvailability: LineItemAvailabilityService,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    userId: string,
    dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    await assertCompanyActive(companyId, {
      companyRepository: this.companyRepository,
    });

    // Disponibilidad (activos, combo coherente, tamaño obligatorio) solo al
    // añadir: GET /cart no debe romperse si algo se desactiva después.
    await this.lineItemAvailability.assertAvailable(dto);

    // Valida que la línea sea coherente contra el catálogo (mismo check que la
    // creación de orden); el precio se descarta porque el carrito no lo congela.
    await this.lineItemPricingService.priceLineItem({
      productId: dto.productId,
      productSizeId: dto.productSizeId,
      comboId: dto.comboId,
      quantity: dto.quantity,
      modifiers: dto.modifiers,
    });

    const cart = await this.cartRepository.getOrCreateByCompanyId(companyId);
    const modifierIds = (dto.modifiers ?? []).map(
      (modifier) => modifier.modifierId,
    );

    const existing = cart.findMatchingItem({
      productId: dto.productId,
      productSizeId: dto.productSizeId,
      comboId: dto.comboId,
      modifierIds,
    });

    if (existing) {
      await this.cartRepository.incrementItemQuantity(
        existing.id,
        dto.quantity,
      );
    } else {
      await this.cartRepository.addItem(cart.id, {
        productId: dto.productId,
        productSizeId: dto.productSizeId,
        comboId: dto.comboId,
        quantity: dto.quantity,
        modifierIds,
        addedById: userId,
      });
    }

    return this.cartView.build(companyId);
  }
}
