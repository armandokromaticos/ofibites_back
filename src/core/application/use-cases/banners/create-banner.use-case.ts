import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { IBannerRepository } from "../../../domain/repositories/banner.repository.interface";
import { BANNER_REPOSITORY } from "../../../domain/repositories/banner.repository.interface";
import { CreateBannerDto } from "../../dto/banners/create-banner.dto";
import { BannerEntity } from "../../../domain/entities/banner.entity";

@Injectable()
export class CreateBannerUseCase {
  constructor(
    @Inject(BANNER_REPOSITORY)
    private readonly bannerRepository: IBannerRepository,
  ) {}

  async execute(dto: CreateBannerDto): Promise<BannerEntity> {
    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException("startDate must be before endDate");
    }

    const entity = BannerEntity.fromCreateDto({
      title: dto.title,
      subtitle: dto.subtitle,
      imageUrl: dto.imageUrl,
      imageMobileUrl: dto.imageMobileUrl,
      altText: dto.altText,
      linkUrl: dto.linkUrl,
      section: dto.section ?? "home-carousel",
      order: dto.order ?? 0,
      backgroundColor: dto.backgroundColor,
      startDate,
      endDate,
      isActive: dto.isActive ?? true,
    });

    return await this.bannerRepository.create(entity);
  }
}
