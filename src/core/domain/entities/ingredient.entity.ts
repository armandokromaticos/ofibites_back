import { Ingredient as PrismaIngredient, Prisma } from "@prisma/client";

interface IngredientProps {
  id: string;
  nameEs: string;
  nameEn: string | null;
  image: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Ingrediente del catálogo ("Detalles de la caja" de la ficha del producto).
 * Por ahora solo se lee (T-19c); el CRUD de admin con sus DTOs llega en T-21.
 */
export class IngredientEntity {
  private props: IngredientProps;

  constructor(props: IngredientProps) {
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
  get image(): string | null {
    return this.props.image;
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

  /** Nombre en el idioma pedido; en inglés cae al español si falta. */
  name(lang: "es" | "en" = "es"): string {
    return lang === "en"
      ? this.props.nameEn?.trim() || this.props.nameEs
      : this.props.nameEs;
  }

  static fromPrisma(prisma: PrismaIngredient): IngredientEntity {
    return new IngredientEntity({
      id: prisma.id,
      nameEs: prisma.nameEs,
      nameEn: prisma.nameEn,
      image: prisma.image,
      isActive: prisma.isActive,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  toPrismaCreate(): Prisma.IngredientCreateInput {
    return {
      nameEs: this.props.nameEs,
      nameEn: this.props.nameEn,
      image: this.props.image,
      isActive: this.props.isActive,
    };
  }
}
