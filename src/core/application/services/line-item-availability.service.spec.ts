import { BadRequestException } from "@nestjs/common";
import { LineItemAvailabilityService } from "./line-item-availability.service";
import type { LineItemInput } from "./line-item-pricing.service";
import type { IProductRepository } from "../../domain/repositories/product.repository.interface";
import type { IProductSizeRepository } from "../../domain/repositories/product-size.repository.interface";
import type { IProductModifierRepository } from "../../domain/repositories/product-modifier.repository.interface";
import type { IComboRepository } from "../../domain/repositories/combo.repository.interface";

// Dobles con solo los getters que lee el servicio.
interface Fixtures {
  product?: { isActive: boolean; activeSizes?: number } | null;
  size?: { isActive: boolean } | null;
  combo?: { isActive: boolean; productIds: string[] } | null;
  modifiers?: { id: string; isActive: boolean }[];
}

function setup(f: Fixtures) {
  const productRepository = {
    findUnique: jest.fn(() =>
      Promise.resolve(
        f.product
          ? {
              isActive: f.product.isActive,
              sizes: Array.from({ length: f.product.activeSizes ?? 0 }, () => ({
                isActive: true,
              })),
            }
          : null,
      ),
    ),
  };
  const productSizeRepository = {
    findUnique: jest.fn(() => Promise.resolve(f.size ?? null)),
  };
  const productModifierRepository = {
    findMany: jest.fn(() => Promise.resolve({ data: f.modifiers ?? [] })),
  };
  const comboRepository = {
    findUnique: jest.fn(() =>
      Promise.resolve(
        f.combo
          ? {
              isActive: f.combo.isActive,
              items: f.combo.productIds.map((productId) => ({ productId })),
            }
          : null,
      ),
    ),
  };
  const service = new LineItemAvailabilityService(
    productRepository as unknown as IProductRepository,
    productSizeRepository as unknown as IProductSizeRepository,
    productModifierRepository as unknown as IProductModifierRepository,
    comboRepository as unknown as IComboRepository,
  );
  return { service, productRepository, comboRepository };
}

const line = (overrides: Partial<LineItemInput> = {}): LineItemInput => ({
  productId: "p-1",
  quantity: 1,
  ...overrides,
});

async function expect400(promise: Promise<void>, message: string | RegExp) {
  await expect(promise).rejects.toThrow(BadRequestException);
  await expect(promise).rejects.toThrow(message);
}

describe("LineItemAvailabilityService", () => {
  describe("inactivos", () => {
    it("rechaza un producto inactivo", async () => {
      const { service } = setup({ product: { isActive: false } });
      await expect400(
        service.assertAvailable(line()),
        "El producto p-1 no está disponible",
      );
    });

    it("rechaza un tamaño inactivo", async () => {
      const { service } = setup({
        product: { isActive: true, activeSizes: 1 },
        size: { isActive: false },
      });
      await expect400(
        service.assertAvailable(line({ productSizeId: "s-1" })),
        "El tamaño s-1 no está disponible",
      );
    });

    it("rechaza un modificador inactivo", async () => {
      const { service } = setup({
        product: { isActive: true },
        modifiers: [
          { id: "m-1", isActive: true },
          { id: "m-2", isActive: false },
        ],
      });
      await expect400(
        service.assertAvailable(
          line({ modifiers: [{ modifierId: "m-1" }, { modifierId: "m-2" }] }),
        ),
        "El modificador m-2 no está disponible",
      );
    });

    it("rechaza un combo inactivo", async () => {
      const { service } = setup({
        combo: { isActive: false, productIds: ["p-1"] },
      });
      await expect400(
        service.assertAvailable(line({ comboId: "c-1" })),
        "El combo c-1 no está disponible",
      );
    });

    it("un combo activo se rige por su isActive, no por el del producto ancla", async () => {
      const { service, productRepository } = setup({
        product: { isActive: false },
        combo: { isActive: true, productIds: ["p-1"] },
      });
      await expect(
        service.assertAvailable(line({ comboId: "c-1" })),
      ).resolves.toBeUndefined();
      expect(productRepository.findUnique).not.toHaveBeenCalled();
    });

    it("acepta una línea con todo activo", async () => {
      const { service } = setup({
        product: { isActive: true, activeSizes: 2 },
        size: { isActive: true },
        modifiers: [{ id: "m-1", isActive: true }],
      });
      await expect(
        service.assertAvailable(
          line({ productSizeId: "s-1", modifiers: [{ modifierId: "m-1" }] }),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("combos", () => {
    it("exige que productId pertenezca al combo", async () => {
      const { service } = setup({
        combo: { isActive: true, productIds: ["p-2", "p-3"] },
      });
      await expect400(
        service.assertAvailable(line({ comboId: "c-1" })),
        "El producto p-1 no forma parte del combo c-1",
      );
    });

    it("rechaza un combo sin ítems (ningún productId pertenece)", async () => {
      const { service } = setup({ combo: { isActive: true, productIds: [] } });
      await expect400(
        service.assertAvailable(line({ comboId: "c-1" })),
        /no forma parte del combo/,
      );
    });

    it("rechaza modificadores en un combo", async () => {
      const { service, comboRepository } = setup({
        combo: { isActive: true, productIds: ["p-1"] },
      });
      await expect400(
        service.assertAvailable(
          line({ comboId: "c-1", modifiers: [{ modifierId: "m-1" }] }),
        ),
        "Los combos no admiten modificadores",
      );
      expect(comboRepository.findUnique).not.toHaveBeenCalled();
    });

    it("acepta modifiers vacío en un combo", async () => {
      const { service } = setup({
        combo: { isActive: true, productIds: ["p-1"] },
      });
      await expect(
        service.assertAvailable(line({ comboId: "c-1", modifiers: [] })),
      ).resolves.toBeUndefined();
    });
  });

  describe("tamaño obligatorio", () => {
    it("exige productSizeId si el producto tiene tamaños activos", async () => {
      const { service, productRepository } = setup({
        product: { isActive: true, activeSizes: 2 },
      });
      await expect400(
        service.assertAvailable(line()),
        "El producto p-1 tiene tamaños: indica productSizeId",
      );
      expect(productRepository.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { sizes: { where: { isActive: true } } },
        }),
      );
    });

    it("sin tamaños activos acepta la línea sin productSizeId", async () => {
      const { service } = setup({ product: { isActive: true } });
      await expect(service.assertAvailable(line())).resolves.toBeUndefined();
    });
  });

  it("si algo no existe no lanza: el 404 lo da priceLineItem", async () => {
    const { service } = setup({ product: null, combo: null });
    await expect(service.assertAvailable(line())).resolves.toBeUndefined();
    await expect(
      service.assertAvailable(line({ comboId: "c-x" })),
    ).resolves.toBeUndefined();
  });
});
