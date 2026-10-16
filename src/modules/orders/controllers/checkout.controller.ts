import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
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
import { CheckoutOrderDto } from "../../../core/application/dto/orders/checkout-order.dto";
import { OrderResponseDto } from "../../../core/application/dto/orders/order-response.dto";
import { CheckoutOrderUseCase } from "../../../core/application/use-cases/orders/checkout-order.use-case";

/** Mismo acceso que el carrito: quien puede llenarlo puede confirmarlo. */
const CHECKOUT_ACCESS = {
  platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
  companyRoles: [CompanyRole.COMPANY_ADMIN, CompanyRole.COMPANY_BUYER],
};

/**
 * Va aparte de `OrdersController` porque usa el guard del carrito
 * (`PlatformOrCompanyRoleGuard` + `X-Company-Id`) y no `RolesGuard`.
 */
@ApiTags("Orders")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Company-Id",
  required: true,
  description: "Empresa cuyo carrito se convierte en pedido",
})
@Controller("orders")
@UseGuards(JwtAuthGuard, PlatformOrCompanyRoleGuard)
export class CheckoutController {
  constructor(private readonly checkoutOrderUseCase: CheckoutOrderUseCase) {}

  @Post("checkout")
  @HttpCode(201)
  @PlatformOrCompanyRole(CHECKOUT_ACCESS)
  @ApiOperation({
    summary:
      "Confirmar el pedido desde el carrito de la empresa (precios, IVA y envío del servidor) y vaciar el carrito, en una transacción",
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiResponse({
    status: 400,
    description:
      "Validación, carrito vacío, fecha fuera de corte, dirección no de entrega o líneas no disponibles (`unavailableItems`)",
  })
  @ApiResponse({ status: 403, description: "Sin rol en la empresa" })
  @ApiResponse({
    status: 404,
    description: "La dirección no existe o es de otra empresa",
  })
  @ApiResponse({
    status: 409,
    description: "El carrito cambió durante la confirmación",
  })
  async checkout(
    @Body() dto: CheckoutOrderDto,
    @CurrentUser() user: { id: string; role: Role },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<OrderResponseDto> {
    const companyId = this.requireCompanyId(companyIdHeader);
    const order = await this.checkoutOrderUseCase.execute(
      companyId,
      { id: user.id, role: user.role },
      dto,
    );
    return order.toResponseDto();
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
