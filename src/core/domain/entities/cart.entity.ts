import {
  Cart as PrismaCart,
  CartItem as PrismaCartItem,
  CartItemModifier as PrismaCartItemModifier,
} from "@prisma/client";
import { evaluateLineAvailability } from "../services/line-availability";

// Relaciones opcionales: las carga `CART_FULL_INCLUDE`; sin ellas la línea
// queda sin datos de presentación y se considera disponible.
type PrismaCartItemWithRelations = PrismaCartItem & {
  modifiers?: (PrismaCartItemModifier & {
    modifier?: {
      isActive: boolean;
      sizeRestricted?: boolean;
      group?: { productId: string } | null;
      sizePrices?: { productSizeId: string }[];
    } | null;
  })[];
  product?: {
    nameEs: string;
    nameEn: string | null;
    image: string | null;
    isActive: boolean;
    sizes?: { id: string }[];
  } | null;
  productSize?: {
    productId: string;
    nameEs: string;
    nameEn: string | null;
    servings: number | null;
    isActive: boolean;
  } | null;
  combo?: {
    nameEs: string;
    nameEn: string | null;
    image: string | null;
    isActive: boolean;
    items?: { productId: string }[];
  } | null;
};

type PrismaCartWithRelations = PrismaCart & {
  items?: PrismaCartItemWithRelations[];
};

/** Datos de presentación de una línea (nombre bilingüe, imagen, tamaño). */
export interface CartItemDisplay {
  nameEs: string;
  nameEn: string | null;
  image: string | null;
  sizeNameEs: string | null;
  sizeNameEn: string | null;
  servings: number | null;
  isAvailable: boolean;
}

export interface CartItemInfo {
  id: string;
  productId: string;
  productSizeId: string | null;
  comboId: string | null;
  quantity: number;
  addedById: string | null;
  modifierIds: string[];
  display?: CartItemDisplay;
}

interface CartProps {
  id: string;
  companyId: string;
  items: CartItemInfo[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartLineCandidate {
  productId: string;
  productSizeId?: string | null;
  comboId?: string | null;
  modifierIds: string[];
}

/**
 * Busca una línea con la misma configuración (producto + tamaño/combo + el
 * mismo conjunto de modificadores). Sirve para deduplicar al agregar: si ya
 * existe, se incrementa la cantidad en vez de crear otra línea.
 */
export function findMatchingCartItem<
  T extends Pick<
    CartItemInfo,
    "productId" | "productSizeId" | "comboId" | "modifierIds"
  >,
>(items: T[], candidate: CartLineCandidate): T | undefined {
  const wantedModifiers = sortedUnique(candidate.modifierIds);
  return items.find(
    (item) =>
      item.productId === candidate.productId &&
      item.productSizeId === (candidate.productSizeId ?? null) &&
      item.comboId === (candidate.comboId ?? null) &&
      sameStringSet(sortedUnique(item.modifierIds), wantedModifiers),
  );
}

/**
 * `isAvailable` de una línea: la regla única `evaluateLineAvailability` (la
 * misma de `POST /cart/items`) sobre las relaciones ya cargadas por
 * `CART_FULL_INCLUDE`, sin consultas por línea.
 */
export function isCartItemAvailable(
  item: PrismaCartItemWithRelations,
): boolean {
  const modifiers = item.modifiers ?? [];
  const product = item.product;
  const size = item.productSize;
  const combo = item.combo;
  return (
    evaluateLineAvailability({
      line: {
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        modifierIds: modifiers.map((m) => m.modifierId),
      },
      product: product
        ? {
            isActive: product.isActive,
            hasActiveSizes: (product.sizes ?? []).length > 0,
          }
        : null,
      size: size
        ? { productId: size.productId, isActive: size.isActive }
        : null,
      combo: combo
        ? {
            isActive: combo.isActive,
            productIds: (combo.items ?? []).map((ci) => ci.productId),
          }
        : null,
      modifiers: modifiers.flatMap((m) =>
        m.modifier
          ? [
              {
                id: m.modifierId,
                isActive: m.modifier.isActive,
                groupProductId: m.modifier.group?.productId ?? null,
                sizeRestricted: m.modifier.sizeRestricted ?? false,
                pricedSizeIds: (m.modifier.sizePrices ?? []).map(
                  (sp) => sp.productSizeId,
                ),
              },
            ]
          : [],
      ),
    }) === null
  );
}

function toDisplay(
  item: PrismaCartItemWithRelations,
): CartItemDisplay | undefined {
  const source = item.comboId ? item.combo : item.product;
  if (!source) return undefined;
  return {
    nameEs: source.nameEs,
    nameEn: source.nameEn,
    image: source.image,
    sizeNameEs: item.productSize?.nameEs ?? null,
    sizeNameEn: item.productSize?.nameEn ?? null,
    servings: item.productSize?.servings ?? null,
    isAvailable: isCartItemAvailable(item),
  };
}

export class CartEntity {
  private props: CartProps;

  constructor(props: CartProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }
  get companyId(): string {
    return this.props.companyId;
  }
  get items(): CartItemInfo[] {
    return this.props.items;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  findMatchingItem(candidate: CartLineCandidate): CartItemInfo | undefined {
    return findMatchingCartItem(this.props.items, candidate);
  }

  static fromPrisma(prisma: PrismaCartWithRelations): CartEntity {
    return new CartEntity({
      id: prisma.id,
      companyId: prisma.companyId,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      items: (prisma.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productSizeId: item.productSizeId,
        comboId: item.comboId,
        quantity: item.quantity,
        addedById: item.addedById,
        modifierIds: (item.modifiers ?? []).map(
          (modifier) => modifier.modifierId,
        ),
        display: toDisplay(item),
      })),
    });
  }
}

function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function sameStringSet(first: string[], second: string[]): boolean {
  if (first.length !== second.length) {
    return false;
  }
  return first.every((value, index) => value === second[index]);
}
