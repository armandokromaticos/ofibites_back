import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AddCartItemParams,
  ICartRepository,
} from "../../../domain/repositories/cart.repository.interface";
import { CART_REPOSITORY } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import {
  ORDER_FULL_INCLUDE,
  ORDER_REPOSITORY,
} from "../../../domain/repositories/order.repository.interface";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../../domain/repositories/product.repository.interface";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import { COMBO_REPOSITORY } from "../../../domain/repositories/combo.repository.interface";
import { OrderEntity } from "../../../domain/entities/order.entity";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { Lang } from "../../../domain/enums/lang.enum";
import { Role } from "../../../domain/enums/role.enum";
import {
  LineItemInput,
  LineItemPricingService,
} from "../../services/line-item-pricing.service";
import { LineAvailabilityCode } from "../../../domain/services/line-availability";
import { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import { CartViewService } from "../../services/cart-view.service";
import { assertCompanyActive } from "../../shared/company-active.guard";
import { assertCanReadOrder } from "../../shared/order-read-access";
import { localized } from "../catalog/catalog-entry.mapper";
import {
  CartRepeatSkippedLineDto,
  RepeatOrderIntoCartResponseDto,
} from "../../dto/cart/repeat-order-into-cart-response.dto";

export const CART_REPEAT_REASONS: Record<LineAvailabilityCode, string> = {
  UNAVAILABLE: "Ya no está disponible",
  CONFIGURATION: "Ya no está disponible con el tamaño o los extras elegidos",
  NOT_FOUND: "Ya no existe en el catálogo",
};

/** Estados que no cuentan como "último pedido" para repetir. */
const NOT_REPEATABLE_STATUSES = [OrderStatus.CANCELLED, OrderStatus.REJECTED];

export type RepeatTarget = { orderId: string } | { last: true };

export interface RepeatActor {
  id: string;
  role: Role;
}

interface SkippedLine {
  productId: string;
  comboId: string | null;
  reason: string;
}

/** Motivo para el usuario según el `code` de `evaluateLineAvailability`. */
export function toSkipReason(code: LineAvailabilityCode): string {
  return CART_REPEAT_REASONS[code];
}

/**
 * Copia al carrito de la empresa las líneas de un pedido que sigan
 * disponibles (mismas reglas que `POST /cart/items`). No crea pedido: eso es
 * `RepeatOrderUseCase` (`POST /orders/:id/repeat`).
 */
@Injectable()
export class RepeatOrderIntoCartUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(COMBO_REPOSITORY)
    private readonly comboRepository: IComboRepository,
    private readonly lineItemPricingService: LineItemPricingService,
    private readonly lineItemAvailability: LineItemAvailabilityService,
    private readonly cartView: CartViewService,
  ) {}

  async execute(
    companyId: string,
    actor: RepeatActor,
    target: RepeatTarget,
    lang: Lang = Lang.ES,
  ): Promise<RepeatOrderIntoCartResponseDto> {
    await assertCompanyActive(companyId, {
      companyRepository: this.companyRepository,
    });

    const order = await this.findOrder(companyId, actor, target);

    const lines: AddCartItemParams[] = [];
    const skipped: SkippedLine[] = [];

    // Las validaciones se leen fuera de la transacción; las escrituras van
    // todas juntas en addItemsAtomically.
    for (const item of order.items ?? []) {
      const modifiers = item.modifiers.map((m) => ({
        modifierId: m.modifierId,
      }));
      const input = {
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        quantity: item.quantity,
        modifiers,
      };
      const code = await this.unavailabilityCode(input);
      if (code) {
        skipped.push({
          productId: item.productId,
          comboId: item.comboId,
          reason: toSkipReason(code),
        });
        continue;
      }
      lines.push({
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        quantity: item.quantity,
        modifierIds: modifiers.map((m) => m.modifierId),
        addedById: actor.id,
      });
    }

    if (lines.length === 0) {
      throw new BadRequestException(
        "Ningún producto del pedido sigue disponible para añadir al carrito",
      );
    }

    await this.cartRepository.addItemsAtomically(companyId, lines);

    const response = new RepeatOrderIntoCartResponseDto();
    response.cart = await this.cartView.build(companyId, lang);
    response.added = lines.length;
    response.skipped = await this.withNames(skipped, lang);
    return response;
  }

  /**
   * El `code` sale de la regla única. `priceLineItem` queda como red de
   * seguridad (p. ej. el producto ancla de un combo que ya no existe, que la
   * regla no mira): su 404 → NOT_FOUND y cualquier otro 4xx → CONFIGURATION,
   * por tipo de excepción, sin leer mensajes.
   */
  private async unavailabilityCode(
    input: LineItemInput,
  ): Promise<LineAvailabilityCode | null> {
    const found = await this.lineItemAvailability.check(input);
    if (found) return found.code;
    try {
      await this.lineItemPricingService.priceLineItem(input);
      return null;
    } catch (error) {
      if (error instanceof NotFoundException) return "NOT_FOUND";
      if (error instanceof HttpException) return "CONFIGURATION";
      throw error;
    }
  }

  private async findOrder(
    companyId: string,
    actor: RepeatActor,
    target: RepeatTarget,
  ): Promise<OrderEntity> {
    if ("last" in target) {
      // Siempre un pedido propio: no hace falta más chequeo de visibilidad.
      const { data } = await this.orderRepository.findMany({
        where: {
          companyId,
          userId: actor.id,
          status: { notIn: NOT_REPEATABLE_STATUSES },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: ORDER_FULL_INCLUDE,
      });
      if (data.length === 0) {
        throw new NotFoundException(
          "No tienes pedidos para repetir en esta empresa",
        );
      }
      return data[0];
    }

    const order = await this.orderRepository.findUnique({
      where: { id: target.orderId },
      include: ORDER_FULL_INCLUDE,
    });
    // Un pedido de otra empresa responde igual que uno inexistente.
    if (!order || order.companyId !== companyId) {
      throw new NotFoundException("Pedido no encontrado en esta empresa");
    }
    await assertCanReadOrder(order, actor.id, actor.role, {
      companyMemberRepository: this.companyMemberRepository,
    });
    return order;
  }

  private async withNames(
    skipped: SkippedLine[],
    lang: Lang,
  ): Promise<CartRepeatSkippedLineDto[]> {
    if (skipped.length === 0) return [];

    const comboIds = [
      ...new Set(skipped.flatMap((s) => (s.comboId ? [s.comboId] : []))),
    ];
    const productIds = [
      ...new Set(skipped.filter((s) => !s.comboId).map((s) => s.productId)),
    ];
    const [products, combos] = await Promise.all([
      productIds.length > 0
        ? this.productRepository.findMany({
            where: { id: { in: productIds } },
          })
        : Promise.resolve({ data: [] }),
      comboIds.length > 0
        ? this.comboRepository.findMany({ where: { id: { in: comboIds } } })
        : Promise.resolve({ data: [] }),
    ]);

    const names = new Map<string, string>();
    for (const product of products.data) {
      if (product.id) {
        names.set(product.id, localized(lang, product.nameEs, product.nameEn));
      }
    }
    for (const combo of combos.data) {
      if (combo.id) {
        names.set(combo.id, localized(lang, combo.nameEs, combo.nameEn));
      }
    }

    return skipped.map((s) => {
      const dto = new CartRepeatSkippedLineDto();
      dto.productId = s.productId;
      dto.comboId = s.comboId;
      dto.name =
        names.get(s.comboId ?? s.productId) ??
        (lang === Lang.EN ? "Product not available" : "Producto no disponible");
      dto.reason = s.reason;
      return dto;
    });
  }
}
