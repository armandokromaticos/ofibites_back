import { CartViewService } from "./cart-view.service";
import { CartEntity } from "../../domain/entities/cart.entity";
import type { ICartRepository } from "../../domain/repositories/cart.repository.interface";
import type { LineItemPricingService } from "./line-item-pricing.service";
import type { ICouponRepository } from "../../domain/repositories/coupon.repository.interface";
import { CouponEntity } from "../../domain/entities/coupon.entity";
import { CouponType } from "../../domain/enums/coupon-type.enum";

const DAY = 24 * 60 * 60 * 1000;

function coupon(
  overrides: Partial<ConstructorParameters<typeof CouponEntity>[0]> = {},
): CouponEntity {
  return new CouponEntity({
    id: "coupon-1",
    type: CouponType.GLOBAL,
    nameEs: "VERANO10",
    nameEn: null,
    discountPercent: 10,
    maxDiscount: 50,
    totalQuantity: 100,
    usedQuantity: 0,
    expiresAt: new Date(Date.now() + DAY),
    isActive: true,
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    usages: [],
    ...overrides,
  });
}

function setup(
  subtotals: number[],
  options: { couponId?: string; coupon?: CouponEntity | null } = {},
) {
  const couponRepository = {
    findWithUserUsages: jest.fn(() => Promise.resolve(options.coupon ?? null)),
  };
  const cart = new CartEntity({
    id: "cart-1",
    companyId: "company-1",
    couponId: options.couponId ?? null,
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
    couponRepository as unknown as ICouponRepository,
  );
  return Object.assign(service, { couponMock: couponRepository });
}

describe("CartViewService · summary", () => {
  const ORIGINAL_FEE = process.env.SHIPPING_FLAT_FEE;
  afterEach(() => {
    if (ORIGINAL_FEE === undefined) delete process.env.SHIPPING_FLAT_FEE;
    else process.env.SHIPPING_FLAT_FEE = ORIGINAL_FEE;
  });

  it("149,99 → envío 5 (valor por defecto de SHIPPING_FLAT_FEE)", async () => {
    delete process.env.SHIPPING_FLAT_FEE;
    const dto = await setup([100, 49.99]).build("company-1", "user-1");
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
    const dto = await setup([75, 75]).build("company-1", "user-1");
    expect(dto.summary).toMatchObject({ shipping: 0, tax: 24, total: 174 });
  });

  it("toma la tarifa de SHIPPING_FLAT_FEE", async () => {
    process.env.SHIPPING_FLAT_FEE = "0";
    const dto = await setup([20]).build("company-1", "user-1");
    expect(dto.summary.shipping).toBe(0);
    expect(dto.summary.total).toBe(23.2);
  });

  it("carrito vacío → resumen en 0", async () => {
    const dto = await setup([]).build("company-1", "user-1");
    expect(dto.summary).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
});

describe("CartViewService · cupón", () => {
  beforeEach(() => delete process.env.SHIPPING_FLAT_FEE);

  it("sin cupón → coupon null y discount 0, sin consultar cupones", async () => {
    const view = setup([100]);
    const dto = await view.build("company-1", "user-1");
    expect(dto.coupon).toBeNull();
    expect(dto.summary.discount).toBe(0);
    expect(view.couponMock.findWithUserUsages).not.toHaveBeenCalled();
  });

  it("cupón válido → descuento sobre el subtotal; IVA y envío sobre subtotal − descuento", async () => {
    const view = setup([100, 60], { couponId: "coupon-1", coupon: coupon() });
    const dto = await view.build("company-1", "user-1");

    expect(view.couponMock.findWithUserUsages).toHaveBeenCalledWith(
      { id: "coupon-1" },
      "user-1",
    );
    expect(dto.coupon).toEqual({
      code: "VERANO10",
      discountPercent: 10,
      isValid: true,
    });
    // 160 − 16 = 144 → IVA 23,04; envío 5 (< 150); total 172,04
    expect(dto.summary).toEqual({
      subtotal: 160,
      discount: 16,
      taxRate: 0.16,
      tax: 23.04,
      shipping: 5,
      freeShippingThreshold: 150,
      total: 172.04,
    });
  });

  it("respeta maxDiscount", async () => {
    const dto = await setup([1000], {
      couponId: "coupon-1",
      coupon: coupon({ discountPercent: 50, maxDiscount: 20 }),
    }).build("company-1", "user-1");
    expect(dto.summary.discount).toBe(20);
  });

  it.each([
    ["vencido", { expiresAt: new Date(Date.now() - DAY) }],
    ["inactivo", { isActive: false }],
    ["sin usos", { usedQuantity: 100 }],
    ["de otra empresa", { companyId: "company-2" }],
    [
      "ya usado por el usuario",
      {
        usages: [
          {
            id: "u-1",
            userId: "user-1",
            orderId: "order-9",
            usedAt: new Date(),
          },
        ],
      },
    ],
  ])(
    "cupón %s → isValid false y discount 0 (sigue en el carrito)",
    async (_label, overrides) => {
      const dto = await setup([100], {
        couponId: "coupon-1",
        coupon: coupon(overrides),
      }).build("company-1", "user-1");
      expect(dto.coupon).toEqual({
        code: "VERANO10",
        discountPercent: 10,
        isValid: false,
      });
      expect(dto.summary).toMatchObject({ discount: 0, tax: 16, total: 121 });
    },
  );

  it("cupón borrado entre lecturas → coupon null", async () => {
    const dto = await setup([100], {
      couponId: "coupon-1",
      coupon: null,
    }).build("company-1", "user-1");
    expect(dto.coupon).toBeNull();
    expect(dto.summary.discount).toBe(0);
  });
});
