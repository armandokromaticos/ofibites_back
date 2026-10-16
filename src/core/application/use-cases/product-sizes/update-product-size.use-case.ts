import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IProductSizeRepository } from "../../../domain/repositories/product-size.repository.interface";
import { PRODUCT_SIZE_REPOSITORY } from "../../../domain/repositories/product-size.repository.interface";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../../../domain/repositories/product.repository.interface";
import { UpdateProductSizeDto } from "../../dto/product-sizes/update-product-size.dto";
import { ProductSizeEntity } from "../../../domain/entities/product-size.entity";
import { recalculateProductStock } from "./recalculate-product-stock";

@Injectable()
export class UpdateProductSizeUseCase {
  constructor(
    @Inject(PRODUCT_SIZE_REPOSITORY)
    private readonly productSizeRepository: IProductSizeRepository,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateProductSizeDto,
  ): Promise<ProductSizeEntity> {
    const hasUpdates = Object.values(dto).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new BadRequestException("No fields provided for update");
    }
    const existing = await this.productSizeRepository.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product size with id "${id}" not found`);
    }

    const data: Prisma.ProductSizeUpdateInput = {};
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionEs !== undefined) data.descriptionEs = dto.descriptionEs;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.servings !== undefined) data.servings = dto.servings;

    const updated = await this.productSizeRepository.update({
      where: { id },
      data,
    });

    if (dto.stock !== undefined || dto.isActive !== undefined) {
      await recalculateProductStock(
        existing.productId,
        this.productSizeRepository,
        this.productRepository,
      );
    }

    return updated;
  }
}
