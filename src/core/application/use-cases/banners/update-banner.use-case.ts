import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IBannerRepository } from "../../../domain/repositories/banner.repository.interface";
import { BANNER_REPOSITORY } from "../../../domain/repositories/banner.repository.interface";
import { UpdateBannerDto } from "../../dto/banners/update-banner.dto";
import { BannerEntity } from "../../../domain/entities/banner.entity";

@Injectable()
export class UpdateBannerUseCase {
  constructor(
    @Inject(BANNER_REPOSITORY)
    private readonly bannerRepository: IBannerRepository,
  ) {}

  async execute(id: string, dto: UpdateBannerDto): Promise<BannerEntity> {
    const banner = await this.bannerRepository.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner with id ${id} not found`);
    }

    const data: Prisma.BannerUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    // null (o "" ya convertido a null por el DTO) borra el subtítulo.
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.imageMobileUrl !== undefined) {
      data.imageMobileUrl = dto.imageMobileUrl;
    }
    if (dto.altText !== undefined) data.altText = dto.altText;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl;
    if (dto.section !== undefined) data.section = dto.section;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.backgroundColor !== undefined) {
      data.backgroundColor = dto.backgroundColor;
    }
    if (dto.startDate !== undefined) {
      if (dto.startDate) {
        const parsed = new Date(dto.startDate);
        if (isNaN(parsed.getTime())) {
          throw new BadRequestException(`Invalid startDate: ${dto.startDate}`);
        }
        data.startDate = parsed;
      } else {
        data.startDate = null;
      }
    }
    if (dto.endDate !== undefined) {
      if (dto.endDate) {
        const parsed = new Date(dto.endDate);
        if (isNaN(parsed.getTime())) {
          throw new BadRequestException(`Invalid endDate: ${dto.endDate}`);
        }
        data.endDate = parsed;
      } else {
        data.endDate = null;
      }
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const effectiveStartDate =
      data.startDate !== undefined
        ? (data.startDate as Date | null)
        : banner.startDate;
    const effectiveEndDate =
      data.endDate !== undefined
        ? (data.endDate as Date | null)
        : banner.endDate;

    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate >= effectiveEndDate
    ) {
      throw new BadRequestException("startDate must be before endDate");
    }

    return this.bannerRepository.update({ where: { id }, data });
  }
}
