import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.interface";
import { MeResponseDto } from "../../dto/auth/me-response.dto";
import { UpdateMeDto } from "../../dto/auth/update-me.dto";
import { GetMeUseCase } from "./get-me.use-case";

export interface UpdateMeActor {
  id: string;
  authId: string;
}

/**
 * "Mi perfil": el usuario del token edita su nombre y teléfono (en `User`) y
 * su cargo (en el `CompanyMember` activo de la empresa de `X-Company-Id`).
 * Devuelve la misma forma que `GET /auth/me`.
 */
@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY)
    private readonly companyMemberRepository: ICompanyMemberRepository,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  async execute(
    actor: UpdateMeActor,
    dto: UpdateMeDto,
    companyId?: string,
  ): Promise<MeResponseDto> {
    const touchesUser = dto.name !== undefined || dto.phone !== undefined;
    const touchesPosition = dto.position !== undefined;

    if (!touchesUser && !touchesPosition) {
      throw new BadRequestException(
        "Envía al menos un campo para actualizar: name, phone o position",
      );
    }
    // Defensa extra: el DTO ya rechaza name null o vacío.
    if (dto.name === null || dto.name === "") {
      throw new BadRequestException("name no puede estar vacío");
    }

    // Todas las comprobaciones antes de escribir nada.
    let membershipId: string | null = null;
    if (touchesPosition) {
      if (!companyId) {
        throw new BadRequestException(
          "Header X-Company-Id requerido para actualizar el cargo",
        );
      }
      const membership =
        await this.companyMemberRepository.findActiveByUserAndCompany(
          actor.id,
          companyId,
        );
      if (!membership) {
        throw new ForbiddenException(
          "No tienes una membresía activa en esta empresa",
        );
      }
      membershipId = membership.id;
    }

    if (touchesUser) {
      await this.userRepository.update({
        where: { id: actor.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
        },
      });
    }

    if (membershipId) {
      await this.companyMemberRepository.update({
        where: { id: membershipId },
        data: { position: dto.position ?? null },
      });
    }

    return this.getMeUseCase.execute(actor.authId);
  }
}
