import { ProductSize as PrismaProductSize, Prisma } from "@prisma/client";
import { CreateProductSizeDto } from "../../application/dto/product-sizes/create-product-size.dto";
import { ProductSizeResponseDto } from "../../application/dto/product-sizes/product-size-response.dto";

interface ProductSizeProps {
  id: string;
  productId: string;
  nameEs: string;
  nameEn: string | null;
  descriptionEs: string | null;
  descriptionEn: string | null;
  price: number;
  stock: number | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  servings: number | null;
}

export class ProductSizeEntity {
  private props: ProductSizeProps;

  constructor(props: ProductSizeProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }
  get productId(): string {
    return this.props.productId;
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
  get stock(): number | null {
    return this.props.stock;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  /** Personas que rinde el tamaño (selector de la ficha); `null` si no se cargó. */
  get servings(): number | null {
    return this.props.servings;
  }

  static fromPrisma(prisma: PrismaProductSize): ProductSizeEntity {
    return new ProductSizeEntity({
      id: prisma.id,
      productId: prisma.productId,
      nameEs: prisma.nameEs,
      nameEn: prisma.nameEn,
      descriptionEs: prisma.descriptionEs,
      descriptionEn: prisma.descriptionEn,
      price: Number(prisma.price),
      stock: prisma.stock,
      sortOrder: prisma.sortOrder,
      isDefault: prisma.isDefault,
      isActive: prisma.isActive,
      servings: prisma.servings,
    });
  }

  static fromCreateDto(
    productId: string,
    dto: CreateProductSizeDto,
  ): ProductSizeEntity {
    return new ProductSizeEntity({
      id: "",
      productId,
      nameEs: dto.nameEs.trim(),
      nameEn: dto.nameEn?.trim() || null,
      descriptionEs: dto.descriptionEs?.trim() || null,
      descriptionEn: dto.descriptionEn?.trim() || null,
      price: dto.price,
      stock: dto.stock ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      servings: dto.servings ?? null,
    });
  }

  toPrismaCreate(): Prisma.ProductSizeCreateInput {
    return {
      nameEs: this.props.nameEs,
      nameEn: this.props.nameEn,
      descriptionEs: this.props.descriptionEs,
      descriptionEn: this.props.descriptionEn,
      price: new Prisma.Decimal(this.props.price),
      stock: this.props.stock,
      sortOrder: this.props.sortOrder,
      isDefault: this.props.isDefault,
      isActive: this.props.isActive,
      servings: this.props.servings,
      product: { connect: { id: this.props.productId } },
    };
  }

  toResponseDto(lang: "es" | "en" = "es"): ProductSizeResponseDto {
    const dto = new ProductSizeResponseDto();
    dto.id = this.props.id;
    dto.productId = this.props.productId;
    dto.name =
      lang === "en"
        ? this.props.nameEn?.trim() || this.props.nameEs
        : this.props.nameEs;
    dto.nameEs = this.props.nameEs;
    dto.nameEn = this.props.nameEn;
    dto.description =
      lang === "en"
        ? this.props.descriptionEn?.trim() || this.props.descriptionEs
        : this.props.descriptionEs;
    dto.descriptionEs = this.props.descriptionEs;
    dto.descriptionEn = this.props.descriptionEn;
    dto.price = this.props.price;
    dto.stock = this.props.stock;
    dto.sortOrder = this.props.sortOrder;
    dto.isDefault = this.props.isDefault;
    dto.isActive = this.props.isActive;
    dto.servings = this.props.servings;
    return dto;
  }
}
