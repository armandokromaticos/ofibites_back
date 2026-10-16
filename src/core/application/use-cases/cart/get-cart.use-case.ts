import { Injectable } from "@nestjs/common";
import { CartViewService } from "../../services/cart-view.service";
import { CartResponseDto } from "../../dto/cart/cart-response.dto";
import { Lang } from "../../../domain/enums/lang.enum";

@Injectable()
export class GetCartUseCase {
  constructor(private readonly cartView: CartViewService) {}

  async execute(
    companyId: string,
    lang: Lang = Lang.ES,
  ): Promise<CartResponseDto> {
    return this.cartView.build(companyId, lang);
  }
}
