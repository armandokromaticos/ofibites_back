import { CartViewService } from "./cart-view.service";
import { CartEntity } from "../../domain/entities/cart.entity";
import type { ICartRepository } from "../../domain/repositories/cart.repository.interface";
import type { LineItemPricingService } from "./line-item-pricing.service";

function setup(subtotals: number[]) {
  const cart = new CartEntity({
    id: "cart-1",
    companyId: "company-1",
    items: subtotals.map((_, i) => ({
      id: `ci-${i}`,
      productId: `p-${i}`,
      productSizeId: null,
      comboId: null,
      quantity: 1,
      addedById: null,
      modifierIds: [],
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const service = new CartViewService(
    {
      getOrCreateViewByCompanyId: jest.fn(() => Promise.resolve(cart)),
    } as unknown as ICartRepository,
    {
      priceLines: jest.fn((inputs: { productId: string }[]) =>
        Promise.resolve(
          inputs.map(({ productId }) => {
            const subtotal = subtotals[Number(productId.slice(2))];
            return { unitPrice: subtotal, subtotal, modifiers: [] };
          }),
        ),
      ),
    } as unknown as LineItemPricingService,
  );
  return service;
}

describe("CartViewService · summary", () => {
  const ORIGINAL_FEE = process.env.SHIPPING_FLAT_FEE;
  afterEach(() => {
    if (ORIGINAL_FEE === undefined) delete process.env.SHIPPING_FLAT_FEE;
    else process.env.SHIPPING_FLAT_FEE = ORIGINAL_FEE;
  });

  it("149,99 → envío 5 (valor por defecto de SHIPPING_FLAT_FEE)", async () => {
    delete process.env.SHIPPING_FLAT_FEE;
    const dto = await setup([100, 49.99]).build("company-1");
    expect(dto.subtotal).toBe(149.99);
    expect(dto.summary).toEqual({
      subtotal: 149.99,
      discount: 0,
      taxRate: 0.16,
      tax: 24,
      shipping: 5,
      freeShippingThreshold: 150,
      total: 178.99,
    });
  });

  it("150 → envío gratis", async () => {
    const dto = await setup([75, 75]).build("company-1");
    expect(dto.summary).toMatchObject({ shipping: 0, tax: 24, total: 174 });
  });

  it("toma la tarifa de SHIPPING_FLAT_FEE", async () => {
    process.env.SHIPPING_FLAT_FEE = "0";
    const dto = await setup([20]).build("company-1");
    expect(dto.summary.shipping).toBe(0);
    expect(dto.summary.total).toBe(23.2);
  });

  it("carrito vacío → resumen en 0", async () => {
    const dto = await setup([]).build("company-1");
    expect(dto.summary).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
});
