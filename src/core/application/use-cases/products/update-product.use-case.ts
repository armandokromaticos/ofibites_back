import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IProductRepository } from "../../../domain/repositories/product.repository.interface";
import {
  PRODUCT_FULL_INCLUDE,
  PRODUCT_REPOSITORY,
} from "../../../domain/repositories/product.repository.interface";
import type { IProductSizeRepository } from "../../../domain/repositories/product-size.repository.interface";
import { PRODUCT_SIZE_REPOSITORY } from "../../../domain/repositories/product-size.repository.interface";
import { UpdateProductDto } from "../../dto/products/update-product.dto";
import { ProductEntity } from "../../../domain/entities/product.entity";

@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(PRODUCT_SIZE_REPOSITORY)
    private readonly productSizeRepository: IProductSizeRepository,
  ) {}

  async execute(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const hasUpdates = Object.values(dto).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new BadRequestException("No fields provided for update");
    }
    const existing = await this.productRepository.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    const { data: sizes } = await this.productSizeRepository.findMany({
      where: { productId: id },
    });
    const activeSizesWithStock = sizes.filter(
      (size) => size.isActive && size.stock !== null,
    );

    const data: Prisma.ProductUpdateInput = {};
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionEs !== undefined) data.descriptionEs = dto.descriptionEs;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.basePrice !== undefined) {
      data.basePrice = new Prisma.Decimal(dto.basePrice);
    }
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
    if (dto.isOnSale !== undefined) data.isOnSale = dto.isOnSale;

    if (activeSizesWithStock.length > 0) {
      // Recalcular stock desde sizes si hay tamaños con stock manual
      data.stock = activeSizesWithStock.reduce(
        (sum, size) => sum + size.stock!,
        0,
      );
    } else if (dto.stock !== undefined) {
      data.stock = dto.stock;
    }

    return this.productRepository.update({
      where: { id },
      data,
      include: PRODUCT_FULL_INCLUDE,
    });
  }
}
