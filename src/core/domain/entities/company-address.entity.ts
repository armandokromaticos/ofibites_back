import { CompanyAddress as PrismaCompanyAddress, Prisma } from "@prisma/client";

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface CreateCompanyAddressParams {
  companyId: string;
  label: string;
  line1: string;
  city: string;
  country: string;
  contactName: string;
  contactPhone: string;
  line2?: string | null;
  reference?: string | null;
  state?: string | null;
  zip?: string | null;
  isBilling?: boolean;
  isShipping?: boolean;
  isPrimary?: boolean;
}

export class CompanyAddressEntity {
  id: string;
  companyId: string;
  label: string;
  line1: string;
  line2: string | null;
  reference: string | null;
  city: string;
  state: string | null;
  country: string;
  zip: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isBilling: boolean;
  isShipping: boolean;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromPrisma(prisma: PrismaCompanyAddress): CompanyAddressEntity {
    const entity = new CompanyAddressEntity();
    entity.id = prisma.id;
    entity.companyId = prisma.companyId;
    entity.label = prisma.label;
    entity.line1 = prisma.line1;
    entity.line2 = prisma.line2;
    entity.reference = prisma.reference;
    entity.city = prisma.city;
    entity.state = prisma.state;
    entity.country = prisma.country;
    entity.zip = prisma.zip;
    entity.contactName = prisma.contactName;
    entity.contactPhone = prisma.contactPhone;
    entity.isBilling = prisma.isBilling;
    entity.isShipping = prisma.isShipping;
    entity.isPrimary = prisma.isPrimary;
    entity.createdAt = prisma.createdAt;
    entity.updatedAt = prisma.updatedAt;
    return entity;
  }

  static fromCreateParams(
    params: CreateCompanyAddressParams,
  ): CompanyAddressEntity {
    const entity = new CompanyAddressEntity();
    entity.id = "";
    entity.companyId = params.companyId;
    entity.label = params.label.trim();
    entity.line1 = params.line1.trim();
    entity.line2 = trimOrNull(params.line2);
    entity.reference = trimOrNull(params.reference);
    entity.city = params.city.trim();
    entity.state = trimOrNull(params.state);
    entity.country = params.country.trim();
    entity.zip = trimOrNull(params.zip);
    entity.contactName = params.contactName.trim();
    entity.contactPhone = params.contactPhone.trim();
    entity.isBilling = params.isBilling ?? false;
    entity.isShipping = params.isShipping ?? true;
    entity.isPrimary = params.isPrimary ?? false;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  toPrismaCreate(): Prisma.CompanyAddressCreateInput {
    return {
      label: this.label,
      line1: this.line1,
      line2: this.line2,
      reference: this.reference,
      city: this.city,
      state: this.state,
      country: this.country,
      zip: this.zip,
      contactName: this.contactName,
      contactPhone: this.contactPhone,
      isBilling: this.isBilling,
      isShipping: this.isShipping,
      isPrimary: this.isPrimary,
      company: { connect: { id: this.companyId } },
    };
  }
}
