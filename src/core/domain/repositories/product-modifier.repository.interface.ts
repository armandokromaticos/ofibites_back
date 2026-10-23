import { Prisma } from "@prisma/client";
import { ProductModifierEntity } from "../entities/product-modifier.entity";

export const PRODUCT_MODIFIER_REPOSITORY = Symbol(
  "PRODUCT_MODIFIER_REPOSITORY",
);

export const PRODUCT_MODIFIER_FULL_INCLUDE = {
  tags: { include: { tag: true } },
  sizePrices: true,
} as const satisfies Prisma.ProductModifierInclude;

export interface ModifierSizePriceEntry {
  productSizeId: string;
  priceAdjustment: number;
}

export interface IProductModifierRepository {
  create(entity: ProductModifierEntity): Promise<ProductModifierEntity>;
  findUnique(
    args: Prisma.ProductModifierFindUniqueArgs,
  ): Promise<ProductModifierEntity | null>;
  findMany(
    args?: Prisma.ProductModifierFindManyArgs,
  ): Promise<{ data: ProductModifierEntity[]; total?: number }>;
  update(
    args: Prisma.ProductModifierUpdateArgs,
  ): Promise<ProductModifierEntity>;
  delete(id: string): Promise<void>;
  exists(args: Prisma.ProductModifierCountArgs): Promise<boolean>;

  // Helpers de dominio
  assignTags(modifierId: string, tagIds: string[]): Promise<void>;
  removeTag(modifierId: string, tagId: string): Promise<void>;
  setSizePrices(
    modifierId: string,
    entries: ModifierSizePriceEntry[],
  ): Promise<void>;
  findSizePrices(modifierId: string): Promise<ModifierSizePriceEntry[]>;
  findSizePrice(
    modifierId: string,
    productSizeId: string,
  ): Promise<number | null>;
  /** Precios por tamaño de esos modificadores en esos tamaños: tamaño → modificador → precio. */
  findSizePricesBatch(
    modifierIds: string[],
    productSizeIds: string[],
  ): Promise<Map<string, Map<string, number>>>;
}
