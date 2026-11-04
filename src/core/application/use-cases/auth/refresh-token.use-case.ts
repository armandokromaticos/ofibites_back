import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { RefreshTokenDto } from "../../dto/auth/refresh-token.dto";
import { AuthResponseDto } from "../../dto/auth/auth-response.dto";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    this.logger.log("Intento de refresh token");
    // Cliente efímero: iniciar sesión sobre el admin compartido le deja el JWT
    // del usuario y Storage/PostgREST dejan de usar la service_role (RLS).
    const supabase = this.supabaseService.createEphemeralClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session || !data.user) {
      this.logger.warn(`Refresh fallido: ${error?.message ?? "Sin sesión"}`);
      throw new UnauthorizedException("Refresh token inválido o expirado");
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

    const response = new AuthResponseDto();
    response.accessToken = data.session.access_token;
    response.refreshToken = data.session.refresh_token;
    response.user = user.toResponse();

    this.logger.log(`Refresh exitoso para userId: ${user.id}`);
    return response;
  }
}
