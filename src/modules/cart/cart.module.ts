import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CartController } from "./controllers/cart.controller";
import { CART_REPOSITORY } from "../../core/domain/repositories/cart.repository.interface";
import { CartRepository } from "../../core/infrastructure/repositories/cart.repository";
import { PRODUCT_REPOSITORY } from "../../core/domain/repositories/product.repository.interface";
import { ProductRepository } from "../../core/infrastructure/repositories/product.repository";
import { PRODUCT_SIZE_REPOSITORY } from "../../core/domain/repositories/product-size.repository.interface";
import { ProductSizeRepository } from "../../core/infrastructure/repositories/product-size.repository";
import { PRODUCT_MODIFIER_REPOSITORY } from "../../core/domain/repositories/product-modifier.repository.interface";
import { ProductModifierRepository } from "../../core/infrastructure/repositories/product-modifier.repository";
import { PRODUCT_MODIFIER_GROUP_REPOSITORY } from "../../core/domain/repositories/product-modifier-group.repository.interface";
import { ProductModifierGroupRepository } from "../../core/infrastructure/repositories/product-modifier-group.repository";
import { COMBO_REPOSITORY } from "../../core/domain/repositories/combo.repository.interface";
import { ComboRepository } from "../../core/infrastructure/repositories/combo.repository";
import { COMPANY_REPOSITORY } from "../../core/domain/repositories/company.repository.interface";
import { CompanyRepository } from "../../core/infrastructure/repositories/company.repository";
import { LineItemPricingService } from "../../core/application/services/line-item-pricing.service";
import { LineItemAvailabilityService } from "../../core/application/services/line-item-availability.service";
import { CartViewService } from "../../core/application/services/cart-view.service";
import { GetCartUseCase } from "../../core/application/use-cases/cart/get-cart.use-case";
import { AddCartItemUseCase } from "../../core/application/use-cases/cart/add-cart-item.use-case";
import { UpdateCartItemUseCase } from "../../core/application/use-cases/cart/update-cart-item.use-case";
import { RemoveCartItemUseCase } from "../../core/application/use-cases/cart/remove-cart-item.use-case";
import { ClearCartUseCase } from "../../core/application/use-cases/cart/clear-cart.use-case";
import { RepeatOrderIntoCartUseCase } from "../../core/application/use-cases/cart/repeat-order-into-cart.use-case";
import { ORDER_REPOSITORY } from "../../core/domain/repositories/order.repository.interface";
import { OrderRepository } from "../../core/infrastructure/repositories/order.repository";
import { COUPON_REPOSITORY } from "../../core/domain/repositories/coupon.repository.interface";
import { CouponRepository } from "../../core/infrastructure/repositories/coupon.repository";
import { ApplyCartCouponUseCase } from "../../core/application/use-cases/cart/apply-cart-coupon.use-case";
import { RemoveCartCouponUseCase } from "../../core/application/use-cases/cart/remove-cart-coupon.use-case";
import { INVOICE_REPOSITORY } from "../../core/domain/repositories/invoice.repository.interface";
import { InvoiceRepository } from "../../core/infrastructure/repositories/invoice.repository";
import { CompanyBillingService } from "../../core/application/services/company-billing.service";

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [
    { provide: CART_REPOSITORY, useClass: CartRepository },
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
    { provide: PRODUCT_SIZE_REPOSITORY, useClass: ProductSizeRepository },
    {
      provide: PRODUCT_MODIFIER_REPOSITORY,
      useClass: ProductModifierRepository,
    },
    {
      provide: PRODUCT_MODIFIER_GROUP_REPOSITORY,
      useClass: ProductModifierGroupRepository,
    },
    { provide: COMBO_REPOSITORY, useClass: ComboRepository },
    { provide: COMPANY_REPOSITORY, useClass: CompanyRepository },
    // COMPANY_MEMBER_REPOSITORY lo exporta AuthModule.
    { provide: ORDER_REPOSITORY, useClass: OrderRepository },
    { provide: COUPON_REPOSITORY, useClass: CouponRepository },
    { provide: INVOICE_REPOSITORY, useClass: InvoiceRepository },
    CompanyBillingService,
    LineItemPricingService,
    LineItemAvailabilityService,
    CartViewService,
    GetCartUseCase,
    AddCartItemUseCase,
    UpdateCartItemUseCase,
    RemoveCartItemUseCase,
    ClearCartUseCase,
    RepeatOrderIntoCartUseCase,
    ApplyCartCouponUseCase,
    RemoveCartCouponUseCase,
  ],
})
export class CartModule {}
