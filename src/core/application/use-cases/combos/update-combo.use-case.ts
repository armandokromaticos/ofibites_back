import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IComboRepository } from "../../../domain/repositories/combo.repository.interface";
import {
  COMBO_FULL_INCLUDE,
  COMBO_REPOSITORY,
} from "../../../domain/repositories/combo.repository.interface";
import { UpdateComboDto } from "../../dto/combos/update-combo.dto";
import { ComboEntity } from "../../../domain/entities/combo.entity";

@Injectable()
export class UpdateComboUseCase {
  constructor(
    @Inject(COMBO_REPOSITORY)
    private readonly comboRepository: IComboRepository,
  ) {}

  async execute(id: string, dto: UpdateComboDto): Promise<ComboEntity> {
    const hasUpdates = Object.values(dto).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new BadRequestException("No fields provided for update");
    }
    const existing = await this.comboRepository.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Combo with id ${id} not found`);
    }

    const data: Prisma.ComboUpdateInput = {};
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionEs !== undefined) data.descriptionEs = dto.descriptionEs;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
    if (dto.isOnSale !== undefined) data.isOnSale = dto.isOnSale;

    return this.comboRepository.update({
      where: { id },
      data,
      include: COMBO_FULL_INCLUDE,
    });
  }
}
