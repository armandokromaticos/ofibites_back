import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { ResetCompanyMemberPasswordUseCase } from "./reset-company-member-password.use-case";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import type { UserEntity } from "../../../domain/entities/user.entity";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";

describe("ResetCompanyMemberPasswordUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const memberId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  const findUniqueMember = jest.fn();
  const findUniqueUser = jest.fn();
  const resetPasswordForEmail = jest.fn();

  const memberRepository = {
    findUnique: findUniqueMember,
  } as unknown as ICompanyMemberRepository;
  const userRepository = {
    findUnique: findUniqueUser,
  } as unknown as IUserRepository;
  const supabaseService = {
    getAdmin: () => ({ auth: { resetPasswordForEmail } }),
  } as unknown as SupabaseService;

  let useCase: ResetCompanyMemberPasswordUseCase;
  const originalRedirect = process.env.SUPABASE_RECOVERY_REDIRECT_URL;

  const member = {
    id: memberId,
    companyId,
    userId,
  } as unknown as CompanyMemberEntity;

  const activeUser = {
    id: userId,
    authId: "auth-123",
    email: " Maria@Diageo.com ",
    name: "María Pérez",
  } as unknown as UserEntity;

  beforeEach(() => {
    findUniqueMember.mockReset();
    findUniqueUser.mockReset();
    resetPasswordForEmail.mockReset();
    process.env.SUPABASE_RECOVERY_REDIRECT_URL =
      " http://localhost:3001/reset-password ";
    useCase = new ResetCompanyMemberPasswordUseCase(
      memberRepository,
      userRepository,
      supabaseService,
    );
  });

  afterAll(() => {
    process.env.SUPABASE_RECOVERY_REDIRECT_URL = originalRedirect;
  });

  it("envía el correo de restablecimiento con redirectTo cuando el miembro tiene cuenta activa", async () => {
    findUniqueMember.mockResolvedValue(member);
    findUniqueUser.mockResolvedValue(activeUser);
    resetPasswordForEmail.mockResolvedValue({ error: null });

    const result = await useCase.execute(companyId, memberId);

    expect(resetPasswordForEmail).toHaveBeenCalledWith("maria@diageo.com", {
      redirectTo: "http://localhost:3001/reset-password",
    });
    expect(result).toEqual({
      email: "maria@diageo.com",
      name: "María Pérez",
      message:
        "Se envió el correo de restablecimiento de contraseña vía Supabase.",
    });
  });

  it("lanza 404 si el miembro no existe", async () => {
    findUniqueMember.mockResolvedValue(null);

    await expect(useCase.execute(companyId, memberId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it("lanza 404 si el miembro es de otra empresa", async () => {
    findUniqueMember.mockResolvedValue({
      ...member,
      companyId: "otra-empresa",
    });

    await expect(useCase.execute(companyId, memberId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lanza 400 si el miembro no tiene cuenta de acceso (authId null)", async () => {
    findUniqueMember.mockResolvedValue(member);
    findUniqueUser.mockResolvedValue({ ...activeUser, authId: null });

    await expect(useCase.execute(companyId, memberId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each(["over_email_send_rate_limit", "over_request_rate_limit"])(
    "lanza 429 si Supabase responde %s",
    async (code) => {
      findUniqueMember.mockResolvedValue(member);
      findUniqueUser.mockResolvedValue(activeUser);
      resetPasswordForEmail.mockResolvedValue({
        error: { message: "límite de tasa", code },
      });

      await expect(useCase.execute(companyId, memberId)).rejects.toBeInstanceOf(
        HttpException,
      );
    },
  );

  it("lanza 400 con el mensaje de Supabase ante otro error", async () => {
    findUniqueMember.mockResolvedValue(member);
    findUniqueUser.mockResolvedValue(activeUser);
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "fallo inesperado", code: "unexpected_failure" },
    });

    await expect(useCase.execute(companyId, memberId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("no pasa redirectTo si la variable no está configurada", async () => {
    delete process.env.SUPABASE_RECOVERY_REDIRECT_URL;
    findUniqueMember.mockResolvedValue(member);
    findUniqueUser.mockResolvedValue(activeUser);
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await useCase.execute(companyId, memberId);

    expect(resetPasswordForEmail).toHaveBeenCalledWith("maria@diageo.com", {});
  });
});
