import { BadRequestException } from "@nestjs/common";
import { CreateOrderUseCase } from "./create-order.use-case";
import { Role } from "../../../domain/enums/role.enum";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { ICouponRepository } from "../../../domain/repositories/coupon.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import type { LineItemPricingService } from "../../services/line-item-pricing.service";
import type { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import { CreateOrderDto } from "../../dto/orders/create-order.dto";

function setup(availabilityError?: Error) {
  const orderRepository = { create: jest.fn() };
  const pricing = { priceLineItem: jest.fn() };
  const availability = {
    assertAvailable: jest.fn(() =>
      availabilityError ? Promise.reject(availabilityError) : Promise.resolve(),
    ),
  };
  const useCase = new CreateOrderUseCase(
    orderRepository as unknown as IOrderRepository,
    {
      findUnique: jest.fn(() => Promise.resolve({ isActive: true })),
    } as unknown as ICompanyRepository,
    pricing as unknown as LineItemPricingService,
    {} as unknown as ICouponRepository,
    {} as unknown as ICompanyMemberRepository,
    {} as unknown as IBranchRepository,
    {} as unknown as IDepartmentRepository,
    {
      findUnique: jest.fn(() => Promise.resolve({ companyId: "company-1" })),
    } as unknown as ICompanyAddressRepository,
    availability as unknown as LineItemAvailabilityService,
  );
  return { useCase, orderRepository, pricing, availability };
}

const dto = {
  companyId: "company-1",
  deliveryAddressId: "address-1",
  items: [
    { productId: "p-1", productSizeId: "s-1", quantity: 2 },
    { productId: "p-2", comboId: "c-1", quantity: 1 },
  ],
} as CreateOrderDto;

describe("CreateOrderUseCase · disponibilidad del catálogo", () => {
  it.each([
    "El tamaño s-1 no está disponible",
    "El producto p-2 no forma parte del combo c-1",
    "El producto p-1 tiene tamaños: indica productSizeId",
  ])("rechaza con 400 (%s) sin cotizar ni crear", async (message) => {
    const { useCase, orderRepository, pricing, availability } = setup(
      new BadRequestException(message),
    );

    await expect(
      useCase.execute("user-1", Role.SUPER_ADMIN, dto),
    ).rejects.toThrow(message);
    expect(availability.assertAvailable).toHaveBeenCalledWith(dto.items[0]);
    expect(pricing.priceLineItem).not.toHaveBeenCalled();
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it("valida cada línea antes de cotizar", async () => {
    const { useCase, pricing, availability } = setup();
    pricing.priceLineItem.mockRejectedValue(new Error("corte del test"));

    await expect(
      useCase.execute("user-1", Role.SUPER_ADMIN, dto),
    ).rejects.toThrow("corte del test");
    expect(availability.assertAvailable).toHaveBeenCalledTimes(2);
    expect(availability.assertAvailable).toHaveBeenNthCalledWith(
      2,
      dto.items[1],
    );
  });
});
