import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { ORDER_REPOSITORY } from "../../../domain/repositories/order.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import type { ICouponRepository } from "../../../domain/repositories/coupon.repository.interface";
import { COUPON_REPOSITORY } from "../../../domain/repositories/coupon.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import { BRANCH_REPOSITORY } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import { DEPARTMENT_REPOSITORY } from "../../../domain/repositories/department.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import { COMPANY_ADDRESS_REPOSITORY } from "../../../domain/repositories/company-address.repository.interface";
import { CreateOrderDto } from "../../dto/orders/create-order.dto";
import {
  OrderEntity,
  CreateOrderItemParams,
} from "../../../domain/entities/order.entity";
import { CouponEntity } from "../../../domain/entities/coupon.entity";
import { Role } from "../../../domain/enums/role.enum";
import { LineItemPricingService } from "../../services/line-item-pricing.service";
import { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import { assertCompanyActive } from "../../shared/company-active.guard";

const PLATFORM_BYPASS_MEMBERSHIP_ROLES: ReadonlySet<Role> = new Set([
  Role.SUPER_ADMIN,
  Role.OPS_ADMIN,
]);

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly lineItemPricingService: LineItemPricingService,
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: ICouponRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: IBranchRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: IDepartmentRepository,
    @Inject(COMPANY_ADDRESS_REPOSITORY)
    private readonly companyAddressRepository: ICompanyAddressRepository,
    private readonly lineItemAvailability: LineItemAvailabilityService,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    await this.validateCompanyContext(userId, userRole, dto);

    // Una orden nueva solo con catálogo disponible (activos, combos coherentes).
    for (const itemDto of dto.items) {
      await this.lineItemAvailability.assertAvailable(itemDto);
    }

    const pricedItems = await Promise.all(
      dto.items.map((itemDto) =>
        this.lineItemPricingService.priceLineItem(itemDto),
      ),
    );

    const items: CreateOrderItemParams[] = dto.items.map((itemDto, index) => ({
      productId: itemDto.productId,
      productSizeId: itemDto.productSizeId,
      comboId: itemDto.comboId,
      quantity: itemDto.quantity,
      unitPrice: pricedItems[index].unitPrice,
      subtotal: pricedItems[index].subtotal,
      modifiers: pricedItems[index].modifiers,
    }));

    const subtotal =
      Math.round(items.reduce((sum, item) => sum + item.subtotal, 0) * 100) /
      100;

    let coupon: CouponEntity | null = null;
    let discount = 0;

    if (dto.couponCode) {
      coupon = await this.couponRepository.findByName(
        dto.couponCode.toUpperCase(),
      );
      if (!coupon) {
        throw new BadRequestException(`Coupon "${dto.couponCode}" not found`);
      }
      if (coupon.companyId && coupon.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Coupon "${dto.couponCode}" no aplica a esta empresa`,
        );
      }
      if (!coupon.isValid()) {
        throw new BadRequestException(
          "Coupon is not valid (inactive, expired, or no uses remaining)",
        );
      }
      if (coupon.hasBeenUsedByUser(userId)) {
        throw new BadRequestException("You have already used this coupon");
      }
      discount = coupon.calculateDiscount(subtotal);
    }

    const total = Math.round((subtotal - discount) * 100) / 100;

    const entity = OrderEntity.fromCreateDto({
      userId,
      couponId: coupon?.id,
      companyId: dto.companyId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      createdById: userId,
      deliveryAddressId: dto.deliveryAddressId,
      deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
      deliveryTime: dto.deliveryTime,
      notes: dto.notes,
      priority: dto.priority,
      subtotal,
      discount,
      total,
      items,
    });
    const createdOrder = await this.orderRepository.create(entity);

    if (coupon && coupon.id && createdOrder.id) {
      await this.couponRepository.consumeCoupon(
        coupon.id,
        userId,
        createdOrder.id,
      );
    }

    return createdOrder;
  }

  private async validateCompanyContext(
    userId: string,
    userRole: Role,
    dto: CreateOrderDto,
  ): Promise<void> {
    // Membership primero: un no-miembro recibe siempre el mismo 403 sin que
    // se le filtre si la empresa existe o está activa.
    if (!PLATFORM_BYPASS_MEMBERSHIP_ROLES.has(userRole)) {
      const membership =
        await this.companyMemberRepository.findActiveByUserAndCompany(
          userId,
          dto.companyId,
        );
      if (!membership) {
        throw new ForbiddenException("No perteneces a esta empresa");
      }
    }

    await assertCompanyActive(dto.companyId, {
      companyRepository: this.companyRepository,
    });

    const address = await this.companyAddressRepository.findUnique({
      where: { id: dto.deliveryAddressId },
    });
    if (!address) {
      throw new NotFoundException(
        `Delivery address ${dto.deliveryAddressId} not found`,
      );
    }
    if (address.companyId !== dto.companyId) {
      throw new BadRequestException(
        `Delivery address ${dto.deliveryAddressId} does not belong to company ${dto.companyId}`,
      );
    }

    if (dto.branchId) {
      const branch = await this.branchRepository.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch ${dto.branchId} not found`);
      }
      if (branch.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Branch ${dto.branchId} does not belong to company ${dto.companyId}`,
        );
      }
    }

    if (dto.departmentId) {
      const department = await this.departmentRepository.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new NotFoundException(`Department ${dto.departmentId} not found`);
      }
      if (department.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Department ${dto.departmentId} does not belong to company ${dto.companyId}`,
        );
      }
    }
  }
}
