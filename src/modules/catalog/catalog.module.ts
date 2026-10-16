import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogController } from "./controllers/catalog.controller";
import { SECTION_REPOSITORY } from "../../core/domain/repositories/section.repository.interface";
import { PRODUCT_REPOSITORY } from "../../core/domain/repositories/product.repository.interface";
import { COMBO_REPOSITORY } from "../../core/domain/repositories/combo.repository.interface";
import { SectionRepository } from "../../core/infrastructure/repositories/section.repository";
import { ProductRepository } from "../../core/infrastructure/repositories/product.repository";
import { ComboRepository } from "../../core/infrastructure/repositories/combo.repository";
import { GetCatalogUseCase } from "../../core/application/use-cases/catalog/get-catalog.use-case";
import { GetCatalogItemUseCase } from "../../core/application/use-cases/catalog/get-catalog-item.use-case";

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [
    { provide: SECTION_REPOSITORY, useClass: SectionRepository },
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
    { provide: COMBO_REPOSITORY, useClass: ComboRepository },
    GetCatalogUseCase,
    GetCatalogItemUseCase,
  ],
})
export class CatalogModule {}
