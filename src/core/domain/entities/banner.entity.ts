import { Banner as PrismaBanner, Prisma } from "@prisma/client";
import { BannerResponseDto } from "../../application/dto/banners/banner-response.dto";

interface BannerProps {
  id: string | undefined;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  imageMobileUrl: string | null;
  altText: string;
  linkUrl: string | null;
  section: string;
  order: number;
  backgroundColor: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBannerParams {
  title?: string;
  subtitle?: string | null;
  imageUrl: string;
  imageMobileUrl?: string;
  altText: string;
  linkUrl?: string;
  section: string;
  order: number;
  backgroundColor?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}

export class BannerEntity {
  private props: BannerProps;

  constructor(props: BannerProps) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get title(): string | null {
    return this.props.title;
  }
  get subtitle(): string | null {
    return this.props.subtitle;
  }
  get imageUrl(): string | null {
    return this.props.imageUrl;
  }
  get imageMobileUrl(): string | null {
    return this.props.imageMobileUrl;
  }
  get altText(): string {
    return this.props.altText;
  }
  get linkUrl(): string | null {
    return this.props.linkUrl;
  }
  get section(): string {
    return this.props.section;
  }
  get order(): number {
    return this.props.order;
  }
  get backgroundColor(): string | null {
    return this.props.backgroundColor;
  }
  get startDate(): Date | null {
    return this.props.startDate;
  }
  get endDate(): Date | null {
    return this.props.endDate;
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

  isCurrentlyVisible(): boolean {
    if (!this.props.isActive) return false;
    const now = new Date();
    if (this.props.startDate && this.props.startDate > now) return false;
    if (this.props.endDate && this.props.endDate < now) return false;
    return true;
  }

  static fromCreateDto(params: CreateBannerParams): BannerEntity {
    return new BannerEntity({
      id: undefined,
      title: params.title ?? null,
      subtitle: params.subtitle ?? null,
      imageUrl: params.imageUrl,
      imageMobileUrl: params.imageMobileUrl ?? null,
      altText: params.altText,
      linkUrl: params.linkUrl ?? null,
      section: params.section,
      order: params.order,
      backgroundColor: params.backgroundColor ?? null,
      startDate: params.startDate ?? null,
      endDate: params.endDate ?? null,
      isActive: params.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPrisma(prisma: PrismaBanner): BannerEntity {
    return new BannerEntity({
      id: prisma.id,
      title: prisma.title,
      subtitle: prisma.subtitle,
      imageUrl: prisma.imageUrl,
      imageMobileUrl: prisma.imageMobileUrl,
      altText: prisma.altText,
      linkUrl: prisma.linkUrl,
      section: prisma.section,
      order: prisma.order,
      backgroundColor: prisma.backgroundColor,
      startDate: prisma.startDate,
      endDate: prisma.endDate,
      isActive: prisma.isActive,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  toPrismaCreate(): Prisma.BannerCreateInput {
    return {
      title: this.props.title,
      subtitle: this.props.subtitle,
      imageUrl: this.props.imageUrl,
      imageMobileUrl: this.props.imageMobileUrl,
      altText: this.props.altText,
      linkUrl: this.props.linkUrl,
      section: this.props.section,
      order: this.props.order,
      backgroundColor: this.props.backgroundColor,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      isActive: this.props.isActive,
    };
  }

  toResponseDto(): BannerResponseDto {
    if (!this.props.id) {
      throw new Error("Cannot convert unpersisted entity to response DTO");
    }
    const dto = new BannerResponseDto();
    dto.id = this.props.id;
    dto.title = this.props.title;
    dto.subtitle = this.props.subtitle;
    dto.imageUrl = this.props.imageUrl;
    dto.imageMobileUrl = this.props.imageMobileUrl;
    dto.altText = this.props.altText;
    dto.linkUrl = this.props.linkUrl;
    dto.section = this.props.section;
    dto.order = this.props.order;
    dto.backgroundColor = this.props.backgroundColor;
    dto.startDate = this.props.startDate;
    dto.endDate = this.props.endDate;
    dto.isActive = this.props.isActive;
    dto.createdAt = this.props.createdAt;
    dto.updatedAt = this.props.updatedAt;
    return dto;
  }
}
