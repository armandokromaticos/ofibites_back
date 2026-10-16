import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CouponsModule } from "../coupons/coupons.module";
import { BranchesModule } from "../branches/branches.module";
import { DepartmentsModule } from "../departments/departments.module";
import { CompanyAddressesModule } from "../company-addresses/company-addresses.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersController } from "./controllers/orders.controller";
import { CheckoutController } from "./controllers/checkout.controller";
import { CART_REPOSITORY } from "../../core/domain/repositories/cart.repository.interface";
import { CartRepository } from "../../core/infrastructure/repositories/cart.repository";
import { CheckoutOrderUseCase } from "../../core/application/use-cases/orders/checkout-order.use-case";
import { ORDER_REPOSITORY } from "../../core/domain/repositories/order.repository.interface";
import { OrderRepository } from "../../core/infrastructure/repositories/order.repository";
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
import { OrderVisibilityResolver } from "../../core/application/services/order-visibility.resolver";
import { CreateOrderUseCase } from "../../core/application/use-cases/orders/create-order.use-case";
import { GetOrderUseCase } from "../../core/application/use-cases/orders/get-order.use-case";
import { GetOrdersUseCase } from "../../core/application/use-cases/orders/get-orders.use-case";
import { CancelOrderUseCase } from "../../core/application/use-cases/orders/cancel-order.use-case";
import { UpdateOrderStatusUseCase } from "../../core/application/use-cases/orders/update-order-status.use-case";
import { RepeatOrderUseCase } from "../../core/application/use-cases/orders/repeat-order.use-case";

@Module({
  imports: [
    AuthModule,
    CouponsModule,
    BranchesModule,
    DepartmentsModule,
    CompanyAddressesModule,
    NotificationsModule,
  ],
  controllers: [OrdersController, CheckoutController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: OrderRepository },
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
    LineItemPricingService,
    LineItemAvailabilityService,
    OrderVisibilityResolver,
    CreateOrderUseCase,
    GetOrderUseCase,
    GetOrdersUseCase,
    CancelOrderUseCase,
    UpdateOrderStatusUseCase,
    RepeatOrderUseCase,
    CheckoutOrderUseCase,
  ],
})
export class OrdersModule {}
