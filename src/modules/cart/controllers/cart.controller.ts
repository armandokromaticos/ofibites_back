import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { Role } from "../../../core/domain/enums/role.enum";
import { CompanyRole } from "../../../core/domain/enums/company-role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { PlatformOrCompanyRole } from "../../auth/decorators/platform-or-company-role.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { AddCartItemDto } from "../../../core/application/dto/cart/add-cart-item.dto";
import { UpdateCartItemDto } from "../../../core/application/dto/cart/update-cart-item.dto";
import { CartResponseDto } from "../../../core/application/dto/cart/cart-response.dto";
import { GetCartUseCase } from "../../../core/application/use-cases/cart/get-cart.use-case";
import { AddCartItemUseCase } from "../../../core/application/use-cases/cart/add-cart-item.use-case";
import { UpdateCartItemUseCase } from "../../../core/application/use-cases/cart/update-cart-item.use-case";
import { RemoveCartItemUseCase } from "../../../core/application/use-cases/cart/remove-cart-item.use-case";
import { ClearCartUseCase } from "../../../core/application/use-cases/cart/clear-cart.use-case";
import { RepeatOrderIntoCartUseCase } from "../../../core/application/use-cases/cart/repeat-order-into-cart.use-case";
import { CartLangQueryDto } from "../../../core/application/dto/cart/cart-lang-query.dto";
import { RepeatOrderIntoCartResponseDto } from "../../../core/application/dto/cart/repeat-order-into-cart-response.dto";

const orderIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException("orderId debe ser un UUID válido"),
});

const CART_ACCESS = {
  platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
  companyRoles: [CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_BUYER],
};

@ApiTags("Cart")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Company-Id",
  required: true,
  description:
    "Empresa dueña del carrito (carrito único y compartido por empresa).",
})
@Controller("cart")
@UseGuards(JwtAuthGuard, PlatformOrCompanyRoleGuard)
export class CartController {
  constructor(
    private readonly getCartUseCase: GetCartUseCase,
    private readonly addCartItemUseCase: AddCartItemUseCase,
    private readonly updateCartItemUseCase: UpdateCartItemUseCase,
    private readonly removeCartItemUseCase: RemoveCartItemUseCase,
    private readonly clearCartUseCase: ClearCartUseCase,
    private readonly repeatOrderIntoCartUseCase: RepeatOrderIntoCartUseCase,
  ) {}

  @Get()
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({
    summary: "Obtener el carrito de la empresa (con precios vigentes)",
  })
  async getCart(
    @Query() query: CartLangQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.getCartUseCase.execute(companyId, query.lang);
  }

  @Post("items")
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({
    summary:
      "Agregar línea al carrito. Si ya existe una idéntica (producto + tamaño/combo + mismos modificadores) incrementa la cantidad.",
  })
  async addItem(
    @Body() dto: AddCartItemDto,
    @Query() query: CartLangQueryDto,
    @CurrentUser() user: { id: string },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.addCartItemUseCase.execute(companyId, user.id, dto, query.lang);
  }

  @Patch("items/:id")
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({ summary: "Cambiar la cantidad de una línea del carrito" })
  async updateItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
    @Query() query: CartLangQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.updateCartItemUseCase.execute(companyId, id, dto, query.lang);
  }

  @Delete("items/:id")
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({ summary: "Quitar una línea del carrito" })
  async removeItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CartLangQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.removeCartItemUseCase.execute(companyId, id, query.lang);
  }

  @Delete()
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({ summary: "Vaciar el carrito de la empresa" })
  async clear(
    @Query() query: CartLangQueryDto,
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<CartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.clearCartUseCase.execute(companyId, query.lang);
  }

  // Antes que "repeat/:orderId" para que "last" no llegue al pipe de UUID.
  @Post("repeat/last")
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({
    summary:
      "Copiar al carrito las líneas disponibles de mi último pedido en la empresa (sin CANCELLED/REJECTED). No crea pedido.",
  })
  @ApiOkResponse({ type: RepeatOrderIntoCartResponseDto })
  @ApiResponse({
    status: 400,
    description: "Ninguna línea del pedido sigue disponible",
  })
  @ApiResponse({ status: 404, description: "Sin pedidos para repetir" })
  async repeatLastOrder(
    @Query() query: CartLangQueryDto,
    @CurrentUser() user: { id: string; role: Role },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<RepeatOrderIntoCartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.repeatOrderIntoCartUseCase.execute(
      companyId,
      { id: user.id, role: user.role },
      { last: true },
      query.lang,
    );
  }

  @Post("repeat/:orderId")
  @HttpCode(200)
  @PlatformOrCompanyRole(CART_ACCESS)
  @ApiOperation({
    summary:
      "Copiar al carrito (en una transacción) las líneas disponibles de un pedido de la empresa. No crea pedido.",
  })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ type: RepeatOrderIntoCartResponseDto })
  @ApiResponse({
    status: 400,
    description: "Ninguna línea del pedido sigue disponible",
  })
  @ApiResponse({ status: 403, description: "Sin acceso al pedido" })
  @ApiResponse({
    status: 404,
    description: "El pedido no existe o es de otra empresa",
  })
  async repeatOrder(
    @Param("orderId", orderIdPipe) orderId: string,
    @Query() query: CartLangQueryDto,
    @CurrentUser() user: { id: string; role: Role },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<RepeatOrderIntoCartResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    return this.repeatOrderIntoCartUseCase.execute(
      companyId,
      { id: user.id, role: user.role },
      { orderId },
      query.lang,
    );
  }

  private requireCompanyId(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException("X-Company-Id es requerido");
    }
    if (!isUUID(trimmed, "4")) {
      throw new BadRequestException("X-Company-Id debe ser un UUID válido");
    }
    return trimmed;
  }
}
