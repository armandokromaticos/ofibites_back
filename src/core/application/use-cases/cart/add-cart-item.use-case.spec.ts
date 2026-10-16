import { BadRequestException } from "@nestjs/common";
import { AddCartItemUseCase } from "./add-cart-item.use-case";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { LineItemPricingService } from "../../services/line-item-pricing.service";
import type { LineItemAvailabilityService } from "../../services/line-item-availability.service";
import type { CartViewService } from "../../services/cart-view.service";
import { AddCartItemDto } from "../../dto/cart/add-cart-item.dto";

function setup(availabilityError?: Error) {
  const cart = { id: "cart-1", findMatchingItem: jest.fn(() => undefined) };
  const cartRepository = {
    getOrCreateByCompanyId: jest.fn(() => Promise.resolve(cart)),
    addItem: jest.fn(() => Promise.resolve()),
    incrementItemQuantity: jest.fn(() => Promise.resolve()),
  };
  const companyRepository = {
    findUnique: jest.fn(() => Promise.resolve({ isActive: true })),
  };
  const pricing = { priceLineItem: jest.fn(() => Promise.resolve({})) };
  const availability = {
    assertAvailable: jest.fn(() =>
      availabilityError ? Promise.reject(availabilityError) : Promise.resolve(),
    ),
  };
  const cartView = { build: jest.fn(() => Promise.resolve({ id: "cart-1" })) };
  const useCase = new AddCartItemUseCase(
    cartRepository as unknown as ICartRepository,
    companyRepository as unknown as ICompanyRepository,
    pricing as unknown as LineItemPricingService,
    availability as unknown as LineItemAvailabilityService,
    cartView as unknown as CartViewService,
  );
  return { useCase, cartRepository, pricing, availability };
}

const comboDto: AddCartItemDto = {
  productId: "p-1",
  comboId: "c-1",
  quantity: 1,
};

describe("AddCartItemUseCase", () => {
  it("valida disponibilidad antes de cotizar y añadir", async () => {
    const { useCase, availability, cartRepository } = setup();

    await useCase.execute("company-1", "user-1", comboDto);

    expect(availability.assertAvailable).toHaveBeenCalledWith(comboDto);
    expect(cartRepository.addItem).toHaveBeenCalled();
  });

  it.each([
    "El producto p-1 no está disponible",
    "El producto p-1 no forma parte del combo c-1",
    "El producto p-1 tiene tamaños: indica productSizeId",
  ])("propaga el 400 (%s) sin tocar el carrito", async (message) => {
    const { useCase, cartRepository, pricing } = setup(
      new BadRequestException(message),
    );

    await expect(
      useCase.execute("company-1", "user-1", comboDto),
    ).rejects.toThrow(message);
    expect(pricing.priceLineItem).not.toHaveBeenCalled();
    expect(cartRepository.addItem).not.toHaveBeenCalled();
    expect(cartRepository.incrementItemQuantity).not.toHaveBeenCalled();
  });
});
