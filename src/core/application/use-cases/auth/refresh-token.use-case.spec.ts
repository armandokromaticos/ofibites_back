import { RefreshTokenUseCase } from "./refresh-token.use-case";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";

describe("RefreshTokenUseCase", () => {
  const refreshSession = jest.fn();
  const getAdmin = jest.fn();
  const createEphemeralClient = jest.fn(() => ({
    auth: { refreshSession },
  }));
  const supabaseService = {
    getAdmin,
    createEphemeralClient,
  } as unknown as SupabaseService;

  const findUnique = jest.fn();
  const userRepository = { findUnique } as unknown as IUserRepository;

  const useCase = new RefreshTokenUseCase(userRepository, supabaseService);

  beforeEach(() => {
    jest.clearAllMocks();
    refreshSession.mockResolvedValue({
      data: {
        user: { id: "auth-1" },
        session: { access_token: "at2", refresh_token: "rt2" },
      },
      error: null,
    });
    findUnique.mockResolvedValue({
      id: "user-1",
      toResponse: () => ({ id: "user-1" }),
    });
  });

  it("refresca la sesión en un cliente efímero, nunca en el admin compartido", async () => {
    const response = await useCase.execute({ refreshToken: "rt" });

    expect(createEphemeralClient).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: "rt" });
    expect(getAdmin).not.toHaveBeenCalled();
    expect(response.accessToken).toBe("at2");
    expect(response.refreshToken).toBe("rt2");
  });
});
