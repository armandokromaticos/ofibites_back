import {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  OrderItemModifier as PrismaOrderItemModifier,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus } from "../enums/order-status.enum";
import { OrderPriority } from "../enums/order-priority.enum";
import {
  OrderResponseDto,
  OrderItemResponseDto,
  OrderItemModifierResponseDto,
} from "../../application/dto/orders/order-response.dto";
import { OrderStateMachine } from "../services/order-state-machine";
import { getOrderStatusGroup } from "../services/order-status-groups";
import { Money } from "../value-objects/money.vo";

// Las columnas del checkout son opcionales para aceptar filas parciales (fixtures).
type CheckoutOrderColumns =
  | "tax"
  | "shipping"
  | "orderNumber"
  | "receiverName"
  | "receiverPhone"
  | "addressDetail"
  | "addressReference";

type PrismaOrderWithRelations = Omit<PrismaOrder, CheckoutOrderColumns> & {
  couponId?: string | null;
  subtotal?: Decimal;
  discount?: Decimal;
  tax?: Decimal;
  shipping?: Decimal;
  orderNumber?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  addressDetail?: string | null;
  addressReference?: string | null;
  items?: (PrismaOrderItem & {
    modifiers?: PrismaOrderItemModifier[];
  })[];
};

interface OrderItemModifierInfo {
  id: string | undefined;
  modifierId: string;
  priceAdjustment: number;
}

interface OrderItemInfo {
  id: string | undefined;
  productId: string;
  productSizeId: string | null;
  comboId: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  modifiers: OrderItemModifierInfo[];
}

interface OrderProps {
  id: string | undefined;
  userId: string | null;
  couponId: string | null;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  createdById: string;
  deliveryAddressId: string;
  deliveryDate: Date | null;
  deliveryTime: string | null;
  notes: string | null;
  priority: OrderPriority;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  orderNumber: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  addressDetail: string | null;
  addressReference: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItemInfo[];
}

export interface CreateOrderItemModifierParams {
  modifierId: string;
  priceAdjustment: number;
}

export interface CreateOrderItemParams {
  productId: string;
  productSizeId?: string;
  comboId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  modifiers: CreateOrderItemModifierParams[];
}

export interface CreateOrderParams {
  userId: string;
  companyId: string;
  createdById: string;
  deliveryAddressId: string;
  couponId?: string;
  branchId?: string;
  departmentId?: string;
  deliveryDate?: Date;
  deliveryTime?: string;
  notes?: string;
  priority?: OrderPriority;
  subtotal: number;
  discount: number;
  /** IVA y envío (checkout). Por defecto 0, como los pedidos de POST /orders. */
  tax?: number;
  shipping?: number;
  total: number;
  receiverName?: string;
  receiverPhone?: string;
  addressDetail?: string;
  addressReference?: string;
  items: CreateOrderItemParams[];
}

export class OrderEntity {
  private static readonly stateMachine = new OrderStateMachine();
  private props: OrderProps;

  constructor(props: OrderProps) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get userId(): string | null {
    return this.props.userId;
  }
  get couponId(): string | null {
    return this.props.couponId;
  }
  get companyId(): string {
    return this.props.companyId;
  }
  get branchId(): string | null {
    return this.props.branchId;
  }
  get departmentId(): string | null {
    return this.props.departmentId;
  }
  get createdById(): string {
    return this.props.createdById;
  }
  get deliveryAddressId(): string {
    return this.props.deliveryAddressId;
  }
  get deliveryDate(): Date | null {
    return this.props.deliveryDate;
  }
  get deliveryTime(): string | null {
    return this.props.deliveryTime;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get priority(): OrderPriority {
    return this.props.priority;
  }
  get status(): OrderStatus {
    return this.props.status;
  }
  get subtotal(): number {
    return this.props.subtotal;
  }
  get discount(): number {
    return this.props.discount;
  }
  get total(): number {
    return this.props.total;
  }
  get tax(): number {
    return this.props.tax;
  }
  get shipping(): number {
    return this.props.shipping;
  }
  /** OF-AAAA-NNNN; null solo en pedidos sin backfill o aún no persistidos. */
  get orderNumber(): string | null {
    return this.props.orderNumber;
  }
  get receiverName(): string | null {
    return this.props.receiverName;
  }
  get receiverPhone(): string | null {
    return this.props.receiverPhone;
  }
  get addressDetail(): string | null {
    return this.props.addressDetail;
  }
  get addressReference(): string | null {
    return this.props.addressReference;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get items(): OrderItemInfo[] | undefined {
    return this.props.items;
  }

  canTransitionTo(status: OrderStatus): boolean {
    return OrderEntity.stateMachine.canTransition(this.props.status, status);
  }

  calculateTotal(): Money {
    if (!this.props.items || this.props.items.length === 0) {
      return Money.zero();
    }

    let total = Money.zero();
    for (const item of this.props.items) {
      const unitPrice = Money.create(item.unitPrice);
      const modifiersAdjustment = Money.create(
        item.modifiers.reduce(
          (sum, modifier) => sum + modifier.priceAdjustment,
          0,
        ),
      );
      const itemTotal = unitPrice
        .add(modifiersAdjustment)
        .multiply(item.quantity);
      total = total.add(itemTotal);
    }

    return total;
  }

  static fromCreateDto(params: CreateOrderParams): OrderEntity {
    return new OrderEntity({
      id: undefined,
      userId: params.userId,
      couponId: params.couponId ?? null,
      companyId: params.companyId,
      branchId: params.branchId ?? null,
      departmentId: params.departmentId ?? null,
      createdById: params.createdById,
      deliveryAddressId: params.deliveryAddressId,
      deliveryDate: params.deliveryDate ?? null,
      deliveryTime: params.deliveryTime ?? null,
      notes: params.notes ?? null,
      priority: params.priority ?? OrderPriority.MEDIUM,
      status: OrderStatus.CREATED,
      subtotal: params.subtotal,
      discount: params.discount,
      tax: params.tax ?? 0,
      shipping: params.shipping ?? 0,
      total: params.total,
      // Lo asigna el repositorio dentro de la transacción de creación.
      orderNumber: null,
      receiverName: params.receiverName ?? null,
      receiverPhone: params.receiverPhone ?? null,
      addressDetail: params.addressDetail ?? null,
      addressReference: params.addressReference ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: params.items.map((item) => ({
        id: undefined,
        productId: item.productId,
        productSizeId: item.productSizeId ?? null,
        comboId: item.comboId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        modifiers: item.modifiers.map((modifier) => ({
          id: undefined,
          modifierId: modifier.modifierId,
          priceAdjustment: modifier.priceAdjustment,
        })),
      })),
    });
  }

  /** `orderNumber` lo genera el repositorio (contador por año, en la transacción). */
  toPrismaCreate(orderNumber?: string): Prisma.OrderCreateInput {
    const data: Prisma.OrderCreateInput = {
      priority: this.props.priority,
      subtotal: new Prisma.Decimal(this.props.subtotal),
      discount: new Prisma.Decimal(this.props.discount),
      tax: new Prisma.Decimal(this.props.tax),
      shipping: new Prisma.Decimal(this.props.shipping),
      total: new Prisma.Decimal(this.props.total),
      orderNumber: orderNumber ?? this.props.orderNumber,
      receiverName: this.props.receiverName,
      receiverPhone: this.props.receiverPhone,
      addressDetail: this.props.addressDetail,
      addressReference: this.props.addressReference,
      deliveryDate: this.props.deliveryDate,
      deliveryTime: this.props.deliveryTime,
      notes: this.props.notes,
      company: { connect: { id: this.props.companyId } },
      createdBy: { connect: { id: this.props.createdById } },
      deliveryAddress: {
        connect: {
          companyId_id: {
            companyId: this.props.companyId,
            id: this.props.deliveryAddressId,
          },
        },
      },
      items: {
        create: (this.props.items ?? []).map((item) => ({
          product: { connect: { id: item.productId } },
          productSize: item.productSizeId
            ? { connect: { id: item.productSizeId } }
            : undefined,
          combo: item.comboId ? { connect: { id: item.comboId } } : undefined,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          subtotal: new Prisma.Decimal(item.subtotal),
          modifiers: {
            create: item.modifiers.map((modifier) => ({
              modifier: { connect: { id: modifier.modifierId } },
              priceAdjustment: new Prisma.Decimal(modifier.priceAdjustment),
            })),
          },
        })),
      },
    };

    if (this.props.userId) {
      data.user = { connect: { id: this.props.userId } };
    }
    if (this.props.couponId) {
      data.coupon = { connect: { id: this.props.couponId } };
    }
    if (this.props.branchId) {
      data.branch = {
        connect: {
          companyId_id: {
            companyId: this.props.companyId,
            id: this.props.branchId,
          },
        },
      };
    }
    if (this.props.departmentId) {
      data.department = {
        connect: {
          companyId_id: {
            companyId: this.props.companyId,
            id: this.props.departmentId,
          },
        },
      };
    }

    return data;
  }

  static fromPrisma(prisma: PrismaOrderWithRelations): OrderEntity {
    const props: OrderProps = {
      id: prisma.id,
      userId: prisma.userId ?? null,
      couponId: prisma.couponId ?? null,
      companyId: prisma.companyId,
      branchId: prisma.branchId ?? null,
      departmentId: prisma.departmentId ?? null,
      createdById: prisma.createdById,
      deliveryAddressId: prisma.deliveryAddressId,
      deliveryDate: prisma.deliveryDate ?? null,
      deliveryTime: prisma.deliveryTime ?? null,
      notes: prisma.notes ?? null,
      priority: prisma.priority as OrderPriority,
      status: prisma.status as OrderStatus,
      subtotal: Number(prisma.subtotal ?? prisma.total),
      discount: Number(prisma.discount ?? 0),
      tax: Number(prisma.tax ?? 0),
      shipping: Number(prisma.shipping ?? 0),
      total: Number(prisma.total),
      orderNumber: prisma.orderNumber ?? null,
      receiverName: prisma.receiverName ?? null,
      receiverPhone: prisma.receiverPhone ?? null,
      addressDetail: prisma.addressDetail ?? null,
      addressReference: prisma.addressReference ?? null,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    };

    if (prisma.items) {
      props.items = prisma.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        modifiers: (item.modifiers ?? []).map((modifier) => ({
          id: modifier.id,
          modifierId: modifier.modifierId,
          priceAdjustment: Number(modifier.priceAdjustment),
        })),
      }));
    }

    return new OrderEntity(props);
  }

  toResponseDto(options?: { maskPrices?: boolean }): OrderResponseDto {
    if (!this.props.id) {
      throw new Error("Cannot convert unpersisted entity to response DTO");
    }
    const maskPrices = options?.maskPrices ?? false;
    const dto = new OrderResponseDto();
    dto.id = this.props.id;
    dto.userId = this.props.userId;
    dto.couponId = this.props.couponId;
    dto.companyId = this.props.companyId;
    dto.branchId = this.props.branchId;
    dto.departmentId = this.props.departmentId;
    dto.createdById = this.props.createdById;
    dto.deliveryAddressId = this.props.deliveryAddressId;
    dto.deliveryDate = this.props.deliveryDate;
    dto.deliveryTime = this.props.deliveryTime;
    dto.notes = this.props.notes;
    dto.priority = this.props.priority;
    dto.status = this.props.status;
    dto.statusGroup = getOrderStatusGroup(this.props.status);
    dto.subtotal = maskPrices ? null : this.props.subtotal;
    dto.discount = maskPrices ? null : this.props.discount;
    dto.tax = maskPrices ? null : this.props.tax;
    dto.shipping = maskPrices ? null : this.props.shipping;
    dto.total = maskPrices ? null : this.props.total;
    dto.orderNumber = this.props.orderNumber;
    dto.receiverName = this.props.receiverName;
    dto.receiverPhone = this.props.receiverPhone;
    dto.addressDetail = this.props.addressDetail;
    dto.addressReference = this.props.addressReference;
    dto.createdAt = this.props.createdAt;
    dto.updatedAt = this.props.updatedAt;

    if (this.props.items) {
      dto.items = this.props.items.map((item) => {
        if (!item.id) {
          throw new Error(
            "Cannot convert unpersisted order item to response DTO",
          );
        }
        const itemDto = new OrderItemResponseDto();
        itemDto.id = item.id;
        itemDto.productId = item.productId;
        itemDto.productSizeId = item.productSizeId;
        itemDto.comboId = item.comboId;
        itemDto.quantity = item.quantity;
        itemDto.unitPrice = maskPrices ? null : item.unitPrice;
        itemDto.subtotal = maskPrices ? null : item.subtotal;
        itemDto.modifiers = item.modifiers.map((modifier) => {
          if (!modifier.id) {
            throw new Error(
              "Cannot convert unpersisted order item modifier to response DTO",
            );
          }
          const modDto = new OrderItemModifierResponseDto();
          modDto.id = modifier.id;
          modDto.modifierId = modifier.modifierId;
          modDto.priceAdjustment = maskPrices ? null : modifier.priceAdjustment;
          return modDto;
        });
        return itemDto;
      });
    }

    return dto;
  }
}
