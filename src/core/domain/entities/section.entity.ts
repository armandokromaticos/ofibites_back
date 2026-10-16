import {
  Combo as PrismaCombo,
  ComboItem as PrismaComboItem,
  Prisma,
  Product as PrismaProduct,
  ProductModifier as PrismaProductModifier,
  ProductModifierGroup as PrismaProductModifierGroup,
  ProductSize as PrismaProductSize,
  Section as PrismaSection,
  SectionItem as PrismaSectionItem,
  Tag as PrismaTag,
} from "@prisma/client";
import { CreateSectionDto } from "../../application/dto/sections/create-section.dto";
import {
  SectionResponseDto,
  SectionItemResponseDto,
} from "../../application/dto/sections/section-response.dto";
import { ProductEntity } from "./product.entity";
import { ComboEntity } from "./combo.entity";

type PrismaSectionItemWithRelations = PrismaSectionItem & {
  product?:
    | (PrismaProduct & {
        sizes?: PrismaProductSize[];
        modifierGroups?: (PrismaProductModifierGroup & {
          modifiers: PrismaProductModifier[];
        })[];
        tags?: { tag: PrismaTag }[];
      })
    | null;
  combo?:
    | (PrismaCombo & {
        items?: (PrismaComboItem & { product: PrismaProduct })[];
      })
    | null;
};

type PrismaSectionWithRelations = PrismaSection & {
  items?: PrismaSectionItemWithRelations[];
};

interface SectionItemInfo {
  id: string;
  order: number;
  productId: string | null;
  comboId: string | null;
  product?: ProductEntity;
  combo?: ComboEntity;
}

interface SectionProps {
  id: string;
  nameEs: string;
  nameEn: string | null;
  slug: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: SectionItemInfo[];
}

export class SectionEntity {
  private props: SectionProps;

  constructor(props: SectionProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }
  get nameEs(): string {
    return this.props.nameEs;
  }
  get nameEn(): string | null {
    return this.props.nameEn;
  }
  get slug(): string {
    return this.props.slug;
  }
  get order(): number {
    return this.props.order;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get items(): SectionItemInfo[] | undefined {
    return this.props.items;
  }

  static fromPrisma(prisma: PrismaSectionWithRelations): SectionEntity {
    const props: SectionProps = {
      id: prisma.id,
      nameEs: prisma.nameEs,
      nameEn: prisma.nameEn,
      slug: prisma.slug,
      order: prisma.order,
      isActive: prisma.isActive,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    };

    if (prisma.items) {
      props.items = prisma.items.map((item) => {
        const info: SectionItemInfo = {
          id: item.id,
          order: item.order,
          productId: item.productId,
          comboId: item.comboId,
        };
        if (item.product) {
          info.product = ProductEntity.fromPrisma(item.product);
        }
        if (item.combo) {
          info.combo = ComboEntity.fromPrisma(item.combo);
        }
        return info;
      });
    }

    return new SectionEntity(props);
  }

  static fromCreateDto(dto: CreateSectionDto): SectionEntity {
    return new SectionEntity({
      id: "",
      nameEs: dto.nameEs.trim(),
      nameEn: dto.nameEn?.trim() || null,
      slug: dto.slug.trim().toLowerCase(),
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  toPrismaCreate(): Prisma.SectionCreateInput {
    return {
      nameEs: this.props.nameEs,
      nameEn: this.props.nameEn,
      slug: this.props.slug,
      order: this.props.order,
      isActive: this.props.isActive,
    };
  }

  toAdminResponseDto(lang: "es" | "en" = "es"): SectionResponseDto {
    const dto = this.toResponseDto(lang);
    dto.nameEs = this.props.nameEs;
    dto.nameEn = this.props.nameEn;
    return dto;
  }

  toResponseDto(lang: "es" | "en" = "es"): SectionResponseDto {
    const dto = new SectionResponseDto();
    dto.id = this.props.id;
    dto.name =
      lang === "en"
        ? this.props.nameEn?.trim() || this.props.nameEs
        : this.props.nameEs;
    dto.slug = this.props.slug;
    dto.order = this.props.order;
    dto.isActive = this.props.isActive;
    dto.createdAt = this.props.createdAt;
    dto.updatedAt = this.props.updatedAt;

    if (this.props.items) {
      dto.items = this.props.items.map((item) => {
        const itemDto = new SectionItemResponseDto();
        itemDto.id = item.id;
        itemDto.order = item.order;
        if (item.product) {
          itemDto.type = "product";
          itemDto.product = item.product.toResponseDto(lang);
        }
        if (item.combo) {
          itemDto.type = "combo";
          itemDto.combo = item.combo.toResponseDto(lang);
        }
        return itemDto;
      });
    }

    return dto;
  }
}
