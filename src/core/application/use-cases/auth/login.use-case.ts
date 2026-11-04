import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { COMPANY_REPOSITORY } from "../../../domain/repositories/company.repository.interface";
import { LoginDto } from "../../dto/auth/login.dto";
import { AuthResponseDto } from "../../dto/auth/auth-response.dto";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { Role } from "../../../domain/enums/role.enum";

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log("Intento de login");
    // Cliente efímero: iniciar sesión sobre el admin compartido le deja el JWT
    // del usuario y Storage/PostgREST dejan de usar la service_role (RLS).
    const supabase = this.supabaseService.createEphemeralClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      this.logger.warn(
        `Login fallido: ${error.message} (code=${error.code ?? "?"})`,
      );
      if (error.code === "email_not_confirmed") {
        throw new UnauthorizedException(
          "Tu cuenta aún no está activada. Revisa tu correo para aceptar la invitación o solicita el reenvío.",
        );
      }
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const user = await this.userRepository.findUnique({
      where: { authId: data.user.id },
    });
    if (!user) {
      this.logger.warn(
        `Usuario autenticado pero no encontrado en DB: ${data.user.id}`,
      );
      throw new UnauthorizedException("Usuario no encontrado");
    }

    if (!user.isActive) {
      this.logger.warn(`Login bloqueado: User ${user.id} está desactivado.`);
      throw new UnauthorizedException(
        "Tu cuenta está desactivada. Contacta al administrador.",
      );
    }

    if (user.role === Role.CLIENT) {
      const activeCompanyIds =
        await this.memberRepository.findActiveCompanyIdsByUserId(user.id);
      if (activeCompanyIds.length === 0) {
        this.logger.warn(
          `Login bloqueado: User ${user.id} (CLIENT) sin memberships activos.`,
        );
        throw new UnauthorizedException(
          "Aún no tienes acceso a una empresa. Contacta al administrador de tu empresa.",
        );
      }

      const { data: activeCompanies } = await this.companyRepository.findMany({
        where: { id: { in: activeCompanyIds }, isActive: true },
      });
      if (activeCompanies.length === 0) {
        this.logger.warn(
          `Login bloqueado: User ${user.id} (CLIENT) sin empresas activas.`,
        );
        throw new UnauthorizedException(
          "Tu empresa está desactivada. Contacta con Ofibites.",
        );
      }
    }

    if (!data.session) {
      this.logger.warn(
        `Login exitoso pero sin sesión para authId: ${data.user.id}`,
      );
      throw new UnauthorizedException("Sesión no disponible");
    }

    const response = new AuthResponseDto();
    response.accessToken = data.session.access_token;
    response.refreshToken = data.session.refresh_token;
    response.user = user.toResponse();

    this.logger.log(`Login exitoso para userId: ${user.id}`);
    return response;
  }
}
