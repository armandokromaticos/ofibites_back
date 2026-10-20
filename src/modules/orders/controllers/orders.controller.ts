import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { Role } from "../../../core/domain/enums/role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CreateOrderDto } from "../../../core/application/dto/orders/create-order.dto";
import { UpdateOrderStatusDto } from "../../../core/application/dto/orders/update-order-status.dto";
import { RepeatOrderDto } from "../../../core/application/dto/orders/repeat-order.dto";
import { GetOrdersQueryDto } from "../../../core/application/dto/orders/get-orders-query.dto";
import {
  OrderResponseDto,
  PaginatedOrderResponseDto,
} from "../../../core/application/dto/orders/order-response.dto";
import { RepeatOrderResponseDto } from "../../../core/application/dto/orders/repeat-order-response.dto";
import { CreateOrderUseCase } from "../../../core/application/use-cases/orders/create-order.use-case";
import { GetOrderUseCase } from "../../../core/application/use-cases/orders/get-order.use-case";
import { GetOrdersUseCase } from "../../../core/application/use-cases/orders/get-orders.use-case";
import { CancelOrderUseCase } from "../../../core/application/use-cases/orders/cancel-order.use-case";
import { UpdateOrderStatusUseCase } from "../../../core/application/use-cases/orders/update-order-status.use-case";
import { RepeatOrderUseCase } from "../../../core/application/use-cases/orders/repeat-order.use-case";

@ApiTags("Orders")
@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly getOrdersUseCase: GetOrdersUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly repeatOrderUseCase: RepeatOrderUseCase,
  ) {}

  // Solo plataforma: los clientes crean pedidos por POST /orders/checkout
  // (decisión del usuario 2026-10-16, T-26a).
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary:
      "Crear orden con items (SUPER_ADMIN / OPS_ADMIN). Los clientes usan POST /orders/checkout",
  })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<OrderResponseDto> {
    const entity = await this.createOrderUseCase.execute(
      user.id,
      user.role,
      dto,
    );
    return entity.toResponseDto();
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.OPERATOR, Role.CLIENT)
  @ApiOperation({
    summary:
      "Listar órdenes filtradas según rol y header X-Company-Id (opcional). Sin skip/take devuelve el array plano; con alguno, { data, total }.",
  })
  @ApiHeader({
    name: "X-Company-Id",
    required: false,
    description:
      "Si se envía, restringe la respuesta a esa empresa (validando acceso del usuario).",
  })
  @ApiExtraModels(OrderResponseDto, PaginatedOrderResponseDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        {
          type: "array",
          items: { $ref: getSchemaPath(OrderResponseDto) },
        },
        { $ref: getSchemaPath(PaginatedOrderResponseDto) },
      ],
    },
  })
  async findAllOrders(
    @Query() query: GetOrdersQueryDto,
    @CurrentUser() user: { id: string; role: Role },
    @Headers("x-company-id") companyIdHeader?: string,
  ): Promise<OrderResponseDto[] | PaginatedOrderResponseDto> {
    const companyId = this.parseCompanyIdHeader(companyIdHeader);
    const { data, total } = await this.getOrdersUseCase.execute(
      user.id,
      user.role,
      companyId,
      query,
    );
    const maskPrices = user.role === Role.OPERATOR;
    const dtos = data.map((order) => order.toResponseDto({ maskPrices }));

    if (typeof total === "number") {
      const response = new PaginatedOrderResponseDto();
      response.data = dtos;
      response.total = total;
      return response;
    }
    return dtos;
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.OPERATOR, Role.CLIENT)
  @ApiOperation({ summary: "Obtener orden por ID" })
  async findOneOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<OrderResponseDto> {
    const entity = await this.getOrderUseCase.execute(id, user.id, user.role);
    const maskPrices = user.role === Role.OPERATOR;
    return entity.toResponseDto({ maskPrices });
  }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Cambiar estado de orden (ADMIN)" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string },
  ): Promise<OrderResponseDto> {
    const entity = await this.updateOrderStatusUseCase.execute(
      id,
      dto.status,
      user.id,
    );
    return entity.toResponseDto();
  }

  @Post(":id/cancel")
  @Roles(Role.SUPER_ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Cancelar orden PENDING" })
  async cancelOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<OrderResponseDto> {
    const entity = await this.cancelOrderUseCase.execute(
      id,
      user.id,
      user.role,
    );
    return entity.toResponseDto();
  }

  // Solo plataforma: un cliente repite con POST /cart/repeat/:orderId y confirma
  // en el checkout (decisión del usuario 2026-10-16, T-26a).
  @Post(":id/repeat")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary:
      "Repetir un pedido (SUPER_ADMIN / OPS_ADMIN): re-precia al catálogo actual y omite productos no disponibles. Los clientes usan POST /cart/repeat/:orderId + POST /orders/checkout",
  })
  async repeatOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RepeatOrderDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<RepeatOrderResponseDto> {
    const { order, skippedItems } = await this.repeatOrderUseCase.execute(
      id,
      user.id,
      user.role,
      dto,
    );
    const response = new RepeatOrderResponseDto();
    response.order = order.toResponseDto();
    response.skippedItems = skippedItems;
    return response;
  }

  private parseCompanyIdHeader(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!isUUID(trimmed, "4")) {
      throw new BadRequestException("X-Company-Id debe ser un UUID válido");
    }
    return trimmed;
  }
}
