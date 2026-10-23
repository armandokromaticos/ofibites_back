import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_ADDRESS_REPOSITORY } from "../../../domain/repositories/company-address.repository.interface";
import { CartItemInfo } from "../../../domain/entities/cart.entity";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { CartChangedException } from "../../../domain/exceptions/cart-changed.exception";
import { LineAvailabilityCode } from "../../../domain/services/line-availability";
import { Lang } from "../../../domain/enums/lang.enum";
import { Role } from "../../../domain/enums/role.enum";
import {
  LineItemInput,
  LineItemPricingService,
} from "../../services/line-item-pricing.service";
import {
  LineItemAvailabilityService,
  resolveUnavailabilityCode,
} from "../../services/line-item-availability.service";
import { assertCompanyActive } from "../../shared/company-active.guard";
import { settleInOrder } from "../../shared/settle-in-order.util";
import {
  LINE_CONCURRENCY,
  mapWithConcurrency,
} from "../../shared/map-with-concurrency.util";
import { deliveryCutoffError } from "../../shared/delivery-cutoff";
import {
  checkoutBadRequest,
  checkoutConflict,
  CheckoutErrorCode,
} from "../../shared/checkout-errors";
import { buildOrderSummary } from "../../shared/order-summary.config";
import { toCents } from "../../../domain/services/order-summary";
import { CheckoutOrderDto } from "../../dto/orders/checkout-order.dto";
import { localized } from "../catalog/catalog-entry.mapper";
import { toSkipReason } from "../cart/repeat-order-into-cart.use-case";

export interface CheckoutActor {
  id: string;
  role: Role;
}

/** Línea del carrito que impide confirmar (va en el cuerpo del 400). */
export interface CheckoutUnavailableLine {
  cartItemId: string;
  productId: string;
  comboId: string | null;
  name: string;
  reason: string;
}

export const CHECKOUT_CART_CHANGED_MESSAGE =
  "El carrito cambió mientras confirmabas el pedido. Revísalo y vuelve a confirmar";

export const CHECKOUT_TOTAL_CHANGED_MESSAGE =
  "Los precios o el total del pedido cambiaron desde que lo revisaste. Revísalo y vuelve a confirmar";

export const CHECKOUT_UNAVAILABLE_MESSAGE =
  "Algunos productos del carrito ya no están disponibles. Quítalos para confirmar el pedido";

function toLineInput(item: CartItemInfo): LineItemInput {
  return {
    productId: item.productId,
    productSizeId: item.productSizeId,
    comboId: item.comboId,
    quantity: item.quantity,
    modifiers: item.modifierIds.map((modifierId) => ({ modifierId })),
  };
}

/**
 * `POST /orders/checkout`: crea el pedido desde el carrito de la empresa y lo
 * vacía en una sola transacción. Mismas reglas que `POST /orders`
 * (disponibilidad con `LineItemAvailabilityService` y precios con
 * `LineItemPricingService`) más el corte de entrega y el resumen con IVA y
 * envío de `GET /cart`. El pedido nace en `CREATED`, como en `POST /orders`.
 */
@Injectable()
export class CheckoutOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(COMPANY_ADDRESS_REPOSITORY)
    private readonly companyAddressRepository: ICompanyAddressRepository,
    private readonly lineItemPricingService: LineItemPricingService,
    private readonly lineItemAvailability: LineItemAvailabilityService,
  ) {}

  async execute(
    companyId: string,
    actor: CheckoutActor,
    dto: CheckoutOrderDto,
    now: Date = new Date(),
  ): Promise<OrderEntity> {
    await settleInOrder([
      assertCompanyActive(companyId, {
        companyRepository: this.companyRepository,
      }),
      this.assertShippingAddress(companyId, dto.deliveryAddressId),
    ]);

    const cutoffError = deliveryCutoffError(dto.deliveryDate, now);
    if (cutoffError) {
      throw checkoutBadRequest(cutoffError.code, cutoffError.message);
    }

    const cart =
      await this.cartRepository.getOrCreateViewByCompanyId(companyId);
    if (cart.items.length === 0) {
      throw checkoutBadRequest(
        CheckoutErrorCode.CART_EMPTY,
        "El carrito está vacío",
      );
    }

    const inputs = cart.items.map(toLineInput);
    const unavailable = await this.findUnavailable(cart.items, inputs);
    if (unavailable.length > 0) {
      throw checkoutBadRequest(
        CheckoutErrorCode.CART_ITEMS_UNAVAILABLE,
        CHECKOUT_UNAVAILABLE_MESSAGE,
        { unavailableItems: unavailable },
      );
    }

    // Precios recalculados contra el catálogo actual, nunca los del cliente.
    const items = await this.lineItemPricingService.priceOrderLines(inputs);
    const summary = buildOrderSummary(items.map((item) => item.subtotal));
    // El usuario confirma lo que vio: si el total cambió (precios, tarifa de
    // envío), no se crea el pedido.
    if (
      dto.expectedTotal !== undefined &&
      toCents(dto.expectedTotal) !== toCents(summary.total)
    ) {
      throw checkoutConflict(
        CheckoutErrorCode.TOTAL_CHANGED,
        CHECKOUT_TOTAL_CHANGED_MESSAGE,
      );
    }

    const entity = OrderEntity.fromCreateDto({
      userId: actor.id,
      companyId,
      createdById: actor.id,
      deliveryAddressId: dto.deliveryAddressId,
      // @db.Date: medianoche UTC de la fecha de Caracas elegida.
      deliveryDate: new Date(`${dto.deliveryDate}T00:00:00.000Z`),
      deliveryTime: dto.deliveryTime,
      notes: dto.notes,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      addressDetail: dto.addressDetail,
      addressReference: dto.addressReference,
      subtotal: summary.subtotal,
      discount: summary.discount,
      tax: summary.tax,
      shipping: summary.shipping,
      total: summary.total,
      items,
    });

    try {
      return await this.orderRepository.createFromCart(entity, {
        cartId: cart.id,
        items: cart.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      });
    } catch (error) {
      if (error instanceof CartChangedException) {
        throw checkoutConflict(
          CheckoutErrorCode.CART_CHANGED,
          CHECKOUT_CART_CHANGED_MESSAGE,
        );
      }
      throw error;
    }
  }

  /** 404 si no existe o es de otra empresa (no se filtra cuál); 400 si no es de entrega. */
  private async assertShippingAddress(
    companyId: string,
    addressId: string,
  ): Promise<void> {
    const address = await this.companyAddressRepository.findUnique({
      where: { id: addressId },
    });
    if (!address || address.companyId !== companyId) {
      throw new NotFoundException(
        "Dirección de entrega no encontrada en esta empresa",
      );
    }
    if (!address.isShipping) {
      throw checkoutBadRequest(
        CheckoutErrorCode.ADDRESS_NOT_SHIPPING,
        "La dirección elegida no está habilitada para entregas",
      );
    }
  }

  /**
   * Regla única `evaluateLineAvailability` (vía `LineItemAvailabilityService`)
   * y, como red de seguridad, que la línea se pueda cotizar: es lo mismo que
   * hace "repetir en el carrito", con los mismos motivos para el usuario.
   */
  private async findUnavailable(
    cartItems: CartItemInfo[],
    inputs: LineItemInput[],
  ): Promise<CheckoutUnavailableLine[]> {
    // Hasta LINE_CONCURRENCY líneas a la vez; el resultado sigue el orden del carrito.
    const codes = await mapWithConcurrency(inputs, LINE_CONCURRENCY, (input) =>
      this.unavailabilityCode(input),
    );
    const result: CheckoutUnavailableLine[] = [];
    for (const [index, item] of cartItems.entries()) {
      const code = codes[index];
      if (!code) continue;
      const display = item.display;
      result.push({
        cartItemId: item.id,
        productId: item.productId,
        comboId: item.comboId,
        name: display
          ? localized(Lang.ES, display.nameEs, display.nameEn)
          : "Producto no disponible",
        reason: toSkipReason(code),
      });
    }
    return result;
  }

  /** Ver `resolveUnavailabilityCode` (regla única + red de seguridad del pricing). */
  private unavailabilityCode(
    input: LineItemInput,
  ): Promise<LineAvailabilityCode | null> {
    return resolveUnavailabilityCode(
      this.lineItemAvailability,
      this.lineItemPricingService,
      input,
    );
  }
}
