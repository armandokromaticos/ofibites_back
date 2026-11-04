import { LoginUseCase } from "./login.use-case";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { Role } from "../../../domain/enums/role.enum";

describe("LoginUseCase", () => {
  const signInWithPassword = jest.fn();
  const getAdmin = jest.fn();
  const createEphemeralClient = jest.fn(() => ({
    auth: { signInWithPassword },
  }));
  const supabaseService = {
    getAdmin,
    createEphemeralClient,
  } as unknown as SupabaseService;

  const findUnique = jest.fn();
  const userRepository = { findUnique } as unknown as IUserRepository;

  const useCase = new LoginUseCase(
    userRepository,
    {} as ICompanyMemberRepository,
    {} as ICompanyRepository,
    supabaseService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "auth-1" },
        session: { access_token: "at", refresh_token: "rt" },
      },
      error: null,
    });
    findUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      role: Role.OPS_ADMIN,
      toResponse: () => ({ id: "user-1" }),
    });
  });

  it("inicia sesión en un cliente efímero, nunca en el admin compartido", async () => {
    const response = await useCase.execute({
      email: "ana@empresa.com",
      password: "Clave#1",
    });

    expect(createEphemeralClient).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@empresa.com",
      password: "Clave#1",
    });
    expect(getAdmin).not.toHaveBeenCalled();
    expect(response.accessToken).toBe("at");
    expect(response.refreshToken).toBe("rt");
  });
});
