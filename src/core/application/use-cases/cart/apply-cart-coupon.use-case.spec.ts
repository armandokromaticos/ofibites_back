import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ApplyCartCouponUseCase,
  CART_COUPON_EMPTY_CART_MESSAGE,
} from "./apply-cart-coupon.use-case";
import { RemoveCartCouponUseCase } from "./remove-cart-coupon.use-case";
import { CartEntity } from "../../../domain/entities/cart.entity";
import { CouponEntity } from "../../../domain/entities/coupon.entity";
import { CouponType } from "../../../domain/enums/coupon-type.enum";
import type { ICartRepository } from "../../../domain/repositories/cart.repository.interface";
import type { ICouponRepository } from "../../../domain/repositories/coupon.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { CartViewService } from "../../services/cart-view.service";

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
    usedQuantity: 3,
    expiresAt: new Date(Date.now() + DAY),
    isActive: true,
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    usages: [],
    ...overrides,
  });
}

function cart(itemCount: number, couponId: string | null = null): CartEntity {
  return new CartEntity({
    id: "cart-1",
    companyId: "company-1",
    couponId,
    items: Array.from({ length: itemCount }, (_, i) => ({
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
}

function setup(
  options: {
    found?: CouponEntity | null;
    items?: number;
    couponId?: string | null;
    companyActive?: boolean;
  } = {},
) {
  const cartRepository = {
    getOrCreateByCompanyId: jest.fn(() =>
      Promise.resolve(cart(options.items ?? 1, options.couponId ?? null)),
    ),
    setCoupon: jest.fn(() => Promise.resolve()),
  };
  const couponRepository = {
    findWithUserUsages: jest.fn(() =>
      Promise.resolve(options.found === undefined ? coupon() : options.found),
    ),
  };
  const companyRepository = {
    findUnique: jest.fn(() =>
      Promise.resolve({ isActive: options.companyActive ?? true }),
    ),
  };
  const cartView = {
    build: jest.fn(() => Promise.resolve({ id: "cart-1" })),
  };
  const apply = new ApplyCartCouponUseCase(
    cartRepository as unknown as ICartRepository,
    couponRepository as unknown as ICouponRepository,
    companyRepository as unknown as ICompanyRepository,
    cartView as unknown as CartViewService,
  );
  const remove = new RemoveCartCouponUseCase(
    cartRepository as unknown as ICartRepository,
    cartView as unknown as CartViewService,
  );
  return { apply, remove, cartRepository, couponRepository, cartView };
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).message;
}

describe("ApplyCartCouponUseCase", () => {
  it("OK: normaliza el código, lo guarda en el carrito y devuelve la vista", async () => {
    const { apply, cartRepository, couponRepository, cartView } = setup();

    const result = await apply.execute("company-1", "user-1", {
      code: "  verano10 ",
    });

    expect(couponRepository.findWithUserUsages).toHaveBeenCalledWith(
      { nameEs: "VERANO10" },
      "user-1",
    );
    expect(cartRepository.setCoupon).toHaveBeenCalledWith("cart-1", "coupon-1");
    expect(cartView.build).toHaveBeenCalledWith("company-1", "user-1", "es");
    expect(result).toEqual({ id: "cart-1" });
  });

  it("acepta un cupón de la misma empresa", async () => {
    const { apply, cartRepository } = setup({
      found: coupon({ companyId: "company-1" }),
    });
    await apply.execute("company-1", "user-1", { code: "VERANO10" });
    expect(cartRepository.setCoupon).toHaveBeenCalled();
  });

  it.each([
    ["no existe", null, "Ese código no existe."],
    [
      "vencido",
      coupon({ expiresAt: new Date(Date.now() - DAY) }),
      "Ese código ya no está vigente.",
    ],
    ["inactivo", coupon({ isActive: false }), "Ese código ya no está vigente."],
    [
      "sin usos",
      coupon({ usedQuantity: 100 }),
      "Ese código ya no está vigente.",
    ],
    [
      "de otra empresa",
      coupon({ companyId: "company-2" }),
      "Ese código no aplica a tu empresa.",
    ],
    [
      "ya usado por el usuario",
      coupon({
        usages: [
          { id: "u-1", userId: "user-1", orderId: "o-1", usedAt: new Date() },
        ],
      }),
      "Ya usaste este código.",
    ],
  ])("%s → 400 sin tocar el carrito", async (_label, found, message) => {
    const { apply, cartRepository } = setup({ found });
    expect(
      await rejectionMessage(
        apply.execute("company-1", "user-1", { code: "VERANO10" }),
      ),
    ).toBe(message);
    expect(cartRepository.setCoupon).not.toHaveBeenCalled();
  });

  it("carrito vacío → 400 sin buscar el cupón", async () => {
    const { apply, couponRepository, cartRepository } = setup({ items: 0 });
    expect(
      await rejectionMessage(
        apply.execute("company-1", "user-1", { code: "VERANO10" }),
      ),
    ).toBe("Agrega productos antes de aplicar un código.");
    expect(CART_COUPON_EMPTY_CART_MESSAGE).toBe(
      "Agrega productos antes de aplicar un código.",
    );
    expect(couponRepository.findWithUserUsages).not.toHaveBeenCalled();
    expect(cartRepository.setCoupon).not.toHaveBeenCalled();
  });

  it("empresa desactivada → 403", async () => {
    const { apply } = setup({ companyActive: false });
    await expect(
      apply.execute("company-1", "user-1", { code: "VERANO10" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("RemoveCartCouponUseCase", () => {
  it("quita el cupón y devuelve la vista", async () => {
    const { remove, cartRepository, cartView } = setup({
      couponId: "coupon-1",
    });
    await remove.execute("company-1", "user-1");
    expect(cartRepository.setCoupon).toHaveBeenCalledWith("cart-1", null);
    expect(cartView.build).toHaveBeenCalledWith("company-1", "user-1", "es");
  });

  it("idempotente: sin cupón no escribe y responde igual", async () => {
    const { remove, cartRepository, cartView } = setup({ couponId: null });
    await expect(remove.execute("company-1", "user-1")).resolves.toEqual({
      id: "cart-1",
    });
    expect(cartRepository.setCoupon).not.toHaveBeenCalled();
    expect(cartView.build).toHaveBeenCalled();
  });
});

describe("CouponEntity.discountPercent", () => {
  it("el Decimal de Prisma llega como porcentaje numérico (10 = 10 %)", () => {
    const entity = CouponEntity.fromPrisma({
      id: "coupon-1",
      type: "GLOBAL",
      nameEs: "VERANO10",
      nameEn: null,
      discountPercent: new Prisma.Decimal("10.00"),
      maxDiscount: new Prisma.Decimal("50.00"),
      totalQuantity: 100,
      usedQuantity: 0,
      expiresAt: new Date(Date.now() + DAY),
      isActive: true,
      companyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(entity.discountPercent).toBe(10);
    expect(typeof entity.discountPercent).toBe("number");
  });
});
