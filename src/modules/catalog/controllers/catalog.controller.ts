import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "../../../core/domain/enums/role.enum";
import { PLATFORM_FULL_ACCESS_ROLES } from "../../../core/application/shared/platform-roles.constants";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { GetCatalogQueryDto } from "../../../core/application/dto/catalog/get-catalog-query.dto";
import { CatalogResponseDto } from "../../../core/application/dto/catalog/catalog-response.dto";
import { GetCatalogUseCase } from "../../../core/application/use-cases/catalog/get-catalog.use-case";
import { GetCatalogItemUseCase } from "../../../core/application/use-cases/catalog/get-catalog-item.use-case";
import { GetCatalogItemQueryDto } from "../../../core/application/dto/catalog/get-catalog-item-query.dto";
import { CatalogItemDetailDto } from "../../../core/application/dto/catalog/catalog-item-detail.dto";
import {
  CATALOG_ITEM_KIND,
  type CatalogItemKind,
} from "../../../core/domain/enums/catalog-item-kind.enum";

const kindPipe = new ParseEnumPipe(CATALOG_ITEM_KIND, {
  exceptionFactory: () =>
    new BadRequestException("kind solo admite: product, combo"),
});
const idPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException("id debe ser un UUID válido"),
});

@ApiTags("Catalog")
@Controller("catalog")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CatalogController {
  constructor(
    private readonly getCatalogUseCase: GetCatalogUseCase,
    private readonly getCatalogItemUseCase: GetCatalogItemUseCase,
  ) {}

  @Get()
  // CLIENT compra; SUPER_ADMIN/OPS_ADMIN pueden previsualizar el catálogo.
  @Roles(Role.CLIENT, ...PLATFORM_FULL_ACCESS_ROLES)
  @ApiOperation({
    summary:
      "Catálogo del cliente (pantalla Ordenar): categorías con conteo, preferencias y productos/combos activos filtrados y paginados",
  })
  @ApiOkResponse({ type: CatalogResponseDto })
  async getCatalog(
    @Query() query: GetCatalogQueryDto,
  ): Promise<CatalogResponseDto> {
    return this.getCatalogUseCase.execute(query);
  }

  @Get("items/:kind/:id")
  @Roles(Role.CLIENT, ...PLATFORM_FULL_ACCESS_ROLES)
  @ApiOperation({
    summary:
      "Ficha de un producto o combo activo: galería, personas por tamaño, ingredientes, nutrición y recomendaciones",
  })
  @ApiParam({ name: "kind", enum: Object.values(CATALOG_ITEM_KIND) })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ type: CatalogItemDetailDto })
  @ApiBadRequestResponse({ description: "kind, id o lang inválidos" })
  @ApiNotFoundResponse({ description: "No existe o está inactivo" })
  async getCatalogItem(
    @Param("kind", kindPipe) kind: CatalogItemKind,
    @Param("id", idPipe) id: string,
    @Query() query: GetCatalogItemQueryDto,
  ): Promise<CatalogItemDetailDto> {
    return this.getCatalogItemUseCase.execute(kind, id, query.lang);
  }
}
