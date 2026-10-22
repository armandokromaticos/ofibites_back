import {
  BadRequestException,
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
import { ResetMemberPasswordResponseDto } from "../../dto/company-members/reset-member-password-response.dto";
import { maskEmail } from "../../shared/mask-email.util";

/**
 * Dispara el correo de restablecimiento de contraseña de Supabase para un
 * miembro de empresa con cuenta activa. A diferencia de
 * `ResendCompanyMemberInviteUseCase`, el admin que llama ya sabe que el
 * miembro existe y tiene cuenta, así que no hay que verificar si "ya aceptó
 * la invitación": es un restablecimiento normal, no un primer acceso.
 */
@Injectable()
export class ResetCompanyMemberPasswordUseCase {
  private readonly logger = new Logger(ResetCompanyMemberPasswordUseCase.name);

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
  ): Promise<ResetMemberPasswordResponseDto> {
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
        'Este miembro no tiene una cuenta de acceso todavía; usa "Reenviar invitación".',
      );
    }

    const email = user.email.trim().toLowerCase();
    const maskedEmail = maskEmail(email);
    const redirectTo = process.env.SUPABASE_RECOVERY_REDIRECT_URL?.trim();

    this.logger.log(
      `Restableciendo contraseña del member ${memberId} (${maskedEmail})`,
    );
    const { error } = await this.supabaseService
      .getAdmin()
      .auth.resetPasswordForEmail(email, {
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
        "Se envió el correo de restablecimiento de contraseña vía Supabase.",
    };
  }
}
