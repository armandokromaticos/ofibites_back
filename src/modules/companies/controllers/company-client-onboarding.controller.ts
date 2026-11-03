import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "../../../core/domain/enums/role.enum";
import { CompanyRole } from "../../../core/domain/enums/company-role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { PlatformOrCompanyRole } from "../../auth/decorators/platform-or-company-role.decorator";
import { CompanyResponseDto } from "../../../core/application/dto/companies/company-response.dto";
import { UpdateCompanyFiscalDataDto } from "../../../core/application/dto/companies/update-company-fiscal-data.dto";
import { CompleteCompanyOnboardingResponseDto } from "../../../core/application/dto/companies/complete-company-onboarding-response.dto";
import { UpdateCompanyFiscalDataUseCase } from "../../../core/application/use-cases/companies/update-company-fiscal-data.use-case";
import { CompleteCompanyOnboardingUseCase } from "../../../core/application/use-cases/companies/complete-company-onboarding.use-case";

/**
 * T-34a: endpoints del onboarding del cliente (los usa el COMPANY_ADMIN de la
 * empresa; los admins de plataforma también pueden). Distinto de
 * `company-onboarding`, que es el alta manual de empresas por Ofibites.
 */
@ApiTags("Companies")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Company-Id",
  required: false,
  description:
    "Empresa activa. El guard toma la empresa del parámetro :companyId de la ruta.",
})
@Controller("companies/:companyId")
@UseGuards(JwtAuthGuard, RolesGuard, PlatformOrCompanyRoleGuard)
@Roles(Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.CLIENT)
export class CompanyClientOnboardingController {
  constructor(
    private readonly updateFiscalDataUseCase: UpdateCompanyFiscalDataUseCase,
    private readonly completeOnboardingUseCase: CompleteCompanyOnboardingUseCase,
  ) {}

  @Patch("fiscal-data")
  @PlatformOrCompanyRole({
    platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
    companyRoles: [CompanyRole.COMPANY_ADMIN],
  })
  @ApiOperation({
    summary:
      "Actualizar los datos fiscales editables de la empresa (dirección fiscal y nombre fiscal). Razón social y RIF no son editables.",
  })
  @ApiResponse({
    status: 200,
    description: "Empresa actualizada.",
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validación fallida (dirección fiscal vacía o muy larga).",
  })
  @ApiResponse({
    status: 403,
    description:
      "No eres COMPANY_ADMIN de esta empresa ni admin de plataforma.",
  })
  @ApiResponse({ status: 404, description: "Empresa no encontrada." })
  async updateFiscalData(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyFiscalDataDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.updateFiscalDataUseCase.execute(companyId, dto);
    return CompanyResponseDto.fromEntity(company);
  }

  @Post("onboarding/complete")
  @HttpCode(200)
  @PlatformOrCompanyRole({
    platformRoles: [Role.SUPER_ADMIN, Role.OPS_ADMIN],
    companyRoles: [CompanyRole.COMPANY_ADMIN],
  })
  @ApiOperation({
    summary:
      "Marcar el onboarding de la empresa como completado. Exige dirección fiscal y al menos una sede. Idempotente: si ya estaba completado devuelve la fecha existente.",
  })
  @ApiResponse({
    status: 200,
    description: "Onboarding completado.",
    type: CompleteCompanyOnboardingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Faltan requisitos (p. ej. «Para completar el onboarding falta la dirección fiscal de la empresa y al menos una sede.»).",
  })
  @ApiResponse({
    status: 403,
    description:
      "No eres COMPANY_ADMIN de esta empresa ni admin de plataforma.",
  })
  @ApiResponse({ status: 404, description: "Empresa no encontrada." })
  async completeOnboarding(
    @Param("companyId", ParseUUIDPipe) companyId: string,
  ): Promise<CompleteCompanyOnboardingResponseDto> {
    const completedAt = await this.completeOnboardingUseCase.execute(companyId);
    const dto = new CompleteCompanyOnboardingResponseDto();
    dto.onboardingCompletedAt = completedAt.toISOString();
    return dto;
  }
}
