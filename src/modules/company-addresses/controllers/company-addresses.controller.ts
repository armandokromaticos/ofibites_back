import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "../../../core/domain/enums/role.enum";
import { CompanyRole } from "../../../core/domain/enums/company-role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { PlatformOrCompanyRole } from "../../auth/decorators/platform-or-company-role.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CreateCompanyAddressDto } from "../../../core/application/dto/company-addresses/create-company-address.dto";
import { UpdateCompanyAddressDto } from "../../../core/application/dto/company-addresses/update-company-address.dto";
import { CompanyAddressResponseDto } from "../../../core/application/dto/company-addresses/company-address-response.dto";
import { CompanyAddressBlockingOrderDto } from "../../../core/application/dto/company-addresses/company-address-blocking-order.dto";
import { CreateCompanyAddressUseCase } from "../../../core/application/use-cases/company-addresses/create-company-address.use-case";
import { GetCompanyAddressUseCase } from "../../../core/application/use-cases/company-addresses/get-company-address.use-case";
import { GetCompanyAddressesUseCase } from "../../../core/application/use-cases/company-addresses/get-company-addresses.use-case";
import { UpdateCompanyAddressUseCase } from "../../../core/application/use-cases/company-addresses/update-company-address.use-case";
import { DeleteCompanyAddressUseCase } from "../../../core/application/use-cases/company-addresses/delete-company-address.use-case";
import { GetCompanyAddressBlockingOrdersUseCase } from "../../../core/application/use-cases/company-addresses/get-company-address-blocking-orders.use-case";

@ApiTags("Company Addresses")
@ApiBearerAuth()
@Controller("companies/:companyId/addresses")
@UseGuards(JwtAuthGuard, RolesGuard, PlatformOrCompanyRoleGuard)
export class CompanyAddressesController {
  constructor(
    private readonly createUseCase: CreateCompanyAddressUseCase,
    private readonly getUseCase: GetCompanyAddressUseCase,
    private readonly getAllUseCase: GetCompanyAddressesUseCase,
    private readonly updateUseCase: UpdateCompanyAddressUseCase,
    private readonly deleteUseCase: DeleteCompanyAddressUseCase,
    private readonly getBlockingOrdersUseCase: GetCompanyAddressBlockingOrdersUseCase,
  ) {}

  @Post()
  @PlatformOrCompanyRole({
    platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
    companyRoles: [CompanyRole.COMPANY_ADMIN],
  })
  @ApiOperation({ summary: "Crear dirección" })
  async create(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyAddressDto,
  ): Promise<CompanyAddressResponseDto> {
    const address = await this.createUseCase.execute(companyId, dto);
    return CompanyAddressResponseDto.fromEntity(address);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Listar direcciones de la empresa" })
  async findAll(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyAddressResponseDto[]> {
    const addresses = await this.getAllUseCase.execute(
      companyId,
      user.id,
      user.role,
    );
    return addresses.map((a) => CompanyAddressResponseDto.fromEntity(a));
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Obtener dirección" })
  async findOne(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyAddressResponseDto> {
    const address = await this.getUseCase.execute(
      companyId,
      id,
      user.id,
      user.role,
    );
    return CompanyAddressResponseDto.fromEntity(address);
  }

  @Get(":id/blocking-orders")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({
    summary:
      "Pedidos en curso que usan esta dirección (informativo, para avisar antes de borrar)",
  })
  async findBlockingOrders(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyAddressBlockingOrderDto[]> {
    return this.getBlockingOrdersUseCase.execute(
      companyId,
      id,
      user.id,
      user.role,
    );
  }

  @Patch(":id")
  @PlatformOrCompanyRole({
    platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
    companyRoles: [CompanyRole.COMPANY_ADMIN],
  })
  @ApiOperation({ summary: "Actualizar dirección" })
  async update(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyAddressDto,
  ): Promise<CompanyAddressResponseDto> {
    const address = await this.updateUseCase.execute(companyId, id, dto);
    return CompanyAddressResponseDto.fromEntity(address);
  }

  @Delete(":id")
  @HttpCode(204)
  @PlatformOrCompanyRole({
    platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
    companyRoles: [CompanyRole.COMPANY_ADMIN],
  })
  @ApiOperation({ summary: "Eliminar dirección" })
  async remove(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteUseCase.execute(companyId, id);
  }
}
