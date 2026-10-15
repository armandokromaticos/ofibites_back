import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { ResendMemberInviteResponseDto } from "../../dto/company-members/resend-member-invite-response.dto";
import { maskEmail } from "../../shared/mask-email.util";

@Injectable()
export class ResendCompanyMemberInviteUseCase {
  private readonly logger = new Logger(ResendCompanyMemberInviteUseCase.name);

  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly memberRepository: ICompanyMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async execute(
    companyId: string,
    memberId: string,
  ): Promise<ResendMemberInviteResponseDto> {
    const member = await this.memberRepository.findUnique({
      where: { id: memberId },
    });
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException(
        `Member ${memberId} not found in company ${companyId}`,
      );
    }

    const user = await this.userRepository.findUnique({
      where: { id: member.userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${member.userId} not found`);
    }
    if (!user.authId) {
      throw new BadRequestException(
        "El miembro no tiene cuenta de autenticación; no se puede reenviar la invitación.",
      );
    }

    const supabase = this.supabaseService.getAdmin();

    // Guard: si el usuario ya aceptó (email confirmado), no tiene sentido
    // reenviar. La verificación es best-effort: si falla, igual se reenvía.
    try {
      const { data: authData, error: lookupError } =
        await supabase.auth.admin.getUserById(user.authId);
      if (lookupError) {
        this.logger.warn(
          `No se pudo verificar el estado en Auth del member ${memberId}, se reenvía igual: ${lookupError.message}`,
        );
      } else if (authData?.user?.email_confirmed_at) {
        throw new ConflictException(
          "El usuario ya aceptó la invitación y tiene una cuenta activa.",
        );
      }
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      this.logger.warn(
        `No se pudo verificar el estado en Auth del member ${memberId}, se reenvía igual: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const email = user.email.trim().toLowerCase();
    const maskedEmail = maskEmail(email);
    const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_URL?.trim();

    this.logger.log(
      `Reenviando invitación al member ${memberId} (${maskedEmail})`,
    );
    // El usuario ya existe en Auth (lo creó el invite original), por lo que
    // inviteUserByEmail fallaría. Se reenvía vía recovery: el link permite
    // establecer la contraseña, completando el onboarding.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      this.logger.warn(
        `Error en Supabase resetPasswordForEmail para member ${memberId} (${maskedEmail}): ${error.message} (code=${error.code ?? "?"})`,
      );
      if (
        error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit"
      ) {
        throw new HttpException(
          "Supabase rechazó el envío por límite de tasa. Reintenta más tarde o configura un proveedor SMTP custom.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException(error.message);
    }

    return {
      email,
      name: user.name,
      message:
        "Se reenvió la invitación vía Supabase. El usuario recibirá un email para establecer su contraseña.",
    };
  }
}
