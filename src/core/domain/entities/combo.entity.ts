import {
  Combo as PrismaCombo,
  ComboItem as PrismaComboItem,
  Prisma,
  Product as PrismaProduct,
} from "@prisma/client";
import { CreateComboDto } from "../../application/dto/combos/create-combo.dto";
import { ComboResponseDto } from "../../application/dto/combos/combo-response.dto";
import { Money } from "../value-objects/money.vo";
import type { PricingStrategy, PricingContext } from "../interfaces";

type PrismaComboWithRelations = PrismaCombo & {
  items?: (PrismaComboItem & {
    product: PrismaProduct;
  })[];
};

interface ComboItemInfo {
  id: string;
  productId: string;
  productNameEs: string;
  productNameEn: string | null;
  productBasePrice: number;
  quantity: number;
  sortOrder: number;
}

interface ComboProps {
  id: string | undefined;
  nameEs: string;
  nameEn: string | null;
  descriptionEs: string | null;
  descriptionEn: string | null;
  price: number;
  image: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: ComboItemInfo[];
}

export class ComboEntity {
  private props: ComboProps;

  constructor(props: ComboProps) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get nameEs(): string {
    return this.props.nameEs;
  }
  get nameEn(): string | null {
    return this.props.nameEn;
  }
  get descriptionEs(): string | null {
    return this.props.descriptionEs;
  }
  get descriptionEn(): string | null {
    return this.props.descriptionEn;
  }
  get price(): number {
    return this.props.price;
  }
  get image(): string | null {
    return this.props.image;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get isFeatured(): boolean {
    return this.props.isFeatured;
  }
  get isOnSale(): boolean {
    return this.props.isOnSale;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get items(): ComboItemInfo[] | undefined {
    return this.props.items;
  }

  static fromPrisma(prisma: PrismaComboWithRelations): ComboEntity {
    const props: ComboProps = {
      id: prisma.id,
      nameEs: prisma.nameEs,
      nameEn: prisma.nameEn,
      descriptionEs: prisma.descriptionEs,
      descriptionEn: prisma.descriptionEn,
      price: Number(prisma.price),
      image: prisma.image,
      isActive: prisma.isActive,
      isFeatured: prisma.isFeatured,
      isOnSale: prisma.isOnSale,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    };

    if (prisma.items) {
      props.items = prisma.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameEs: item.product.nameEs,
        productNameEn: item.product.nameEn,
        productBasePrice: Number(item.product.basePrice),
        quantity: item.quantity,
        sortOrder: item.sortOrder,
      }));
    }

    return new ComboEntity(props);
  }

  static fromCreateDto(dto: CreateComboDto): ComboEntity {
    return new ComboEntity({
      id: undefined,
      nameEs: dto.nameEs.trim(),
      nameEn: dto.nameEn?.trim() || null,
      descriptionEs: dto.descriptionEs?.trim() || null,
      descriptionEn: dto.descriptionEn?.trim() || null,
      price: dto.price,
      image: dto.image ?? null,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      isOnSale: dto.isOnSale ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  toPrismaCreate(): Prisma.ComboCreateInput {
    return {
      nameEs: this.props.nameEs,
      nameEn: this.props.nameEn,
      descriptionEs: this.props.descriptionEs,
      descriptionEn: this.props.descriptionEn,
      price: new Prisma.Decimal(this.props.price),
      image: this.props.image,
      isActive: this.props.isActive,
      isFeatured: this.props.isFeatured,
      isOnSale: this.props.isOnSale,
    };
  }

  toResponseDto(lang: "es" | "en" = "es"): ComboResponseDto {
    if (!this.props.id) {
      throw new Error("Cannot convert unpersisted entity to response DTO");
    }
    const dto = new ComboResponseDto();
    dto.id = this.props.id;
    dto.name =
      lang === "en"
        ? this.props.nameEn?.trim() || this.props.nameEs
        : this.props.nameEs;
    dto.description =
      lang === "en"
        ? this.props.descriptionEn?.trim() || this.props.descriptionEs
        : this.props.descriptionEs;
    dto.price = this.props.price;
    dto.image = this.props.image;
    dto.isActive = this.props.isActive;
    dto.isFeatured = this.props.isFeatured;
    dto.isOnSale = this.props.isOnSale;
    dto.createdAt = this.props.createdAt;
    dto.updatedAt = this.props.updatedAt;

    if (this.props.items) {
      dto.items = this.props.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName:
          lang === "en"
            ? item.productNameEn?.trim() || item.productNameEs
            : item.productNameEs,
        productBasePrice: item.productBasePrice,
        quantity: item.quantity,
        sortOrder: item.sortOrder,
      }));
    }

    return dto;
  }

  /**
   * Calculates the total base price of all items in the combo
   * using the provided pricing strategy.
   */
  async calculateBasePrice(
    pricingStrategy: PricingStrategy,
    context: PricingContext = {},
  ): Promise<Money> {
    if (!this.props.items || this.props.items.length === 0) {
      return Money.zero();
    }

    let total = Money.zero();
    for (const item of this.props.items) {
      const itemPrice = await pricingStrategy.getProductPrice(
        item.productId,
        context,
      );
      total = total.add(itemPrice.multiply(item.quantity));
    }

    return total;
  }
}
