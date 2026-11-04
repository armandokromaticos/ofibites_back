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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CreateCompanyDto } from "../../../core/application/dto/companies/create-company.dto";
import { UpdateCompanyDto } from "../../../core/application/dto/companies/update-company.dto";
import { SetCompanyActiveDto } from "../../../core/application/dto/companies/set-company-active.dto";
import { CompanyResponseDto } from "../../../core/application/dto/companies/company-response.dto";
import { CreateCompanyUseCase } from "../../../core/application/use-cases/companies/create-company.use-case";
import { GetCompanyUseCase } from "../../../core/application/use-cases/companies/get-company.use-case";
import { GetCompaniesUseCase } from "../../../core/application/use-cases/companies/get-companies.use-case";
import { UpdateCompanyUseCase } from "../../../core/application/use-cases/companies/update-company.use-case";
import { SetCompanyActiveUseCase } from "../../../core/application/use-cases/companies/set-company-active.use-case";
import { DeleteCompanyUseCase } from "../../../core/application/use-cases/companies/delete-company.use-case";

@ApiTags("Companies")
@ApiBearerAuth()
@Controller("companies")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly getCompanyUseCase: GetCompanyUseCase,
    private readonly getCompaniesUseCase: GetCompaniesUseCase,
    private readonly updateCompanyUseCase: UpdateCompanyUseCase,
    private readonly setCompanyActiveUseCase: SetCompanyActiveUseCase,
    private readonly deleteCompanyUseCase: DeleteCompanyUseCase,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: "Crear empresa" })
  async create(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    const company = await this.createCompanyUseCase.execute(dto);
    return CompanyResponseDto.fromEntity(company);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Listar empresas (admins ven todas; CLIENT solo asignadas)",
  })
  async findAll(
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyResponseDto[]> {
    const companies = await this.getCompaniesUseCase.execute(
      user.id,
      user.role,
    );
    return companies.map((c) => CompanyResponseDto.fromEntity(c));
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Obtener empresa por ID" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyResponseDto> {
    const company = await this.getCompanyUseCase.execute(
      id,
      user.id,
      user.role,
    );
    return CompanyResponseDto.fromEntity(company);
  }

  @Patch(":id")
  // T-06: FINANCE_ADMIN también (edita el cupo de crédito, creditLimit).
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.FINANCE_ADMIN)
  @ApiOperation({ summary: "Actualizar empresa" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<CompanyResponseDto> {
    const company = await this.updateCompanyUseCase.execute(id, dto, user.role);
    return CompanyResponseDto.fromEntity(company);
  }

  @Patch(":id/active")
  @Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary:
      "Activar/desactivar empresa. Una empresa desactivada no puede crear pedidos, construir carrito ni sus miembros iniciar sesión.",
  })
  async setActive(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetCompanyActiveDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.setCompanyActiveUseCase.execute(
      id,
      dto.isActive,
    );
    return CompanyResponseDto.fromEntity(company);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Eliminar empresa" })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteCompanyUseCase.execute(id);
  }
}
