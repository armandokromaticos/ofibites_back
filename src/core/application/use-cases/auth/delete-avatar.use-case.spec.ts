import { DeleteAvatarUseCase } from "./delete-avatar.use-case";
import type { GetMeUseCase } from "./get-me.use-case";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import type { MeResponseDto } from "../../dto/auth/me-response.dto";

const PUBLIC_PREFIX =
  "https://proyecto.supabase.co/storage/v1/object/public/avatars/";

describe("DeleteAvatarUseCase", () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const deleteFile = jest.fn();
  const getPublicUrl = jest.fn();
  const getMeExecute = jest.fn();

  const userRepository = { findUnique, update } as unknown as IUserRepository;
  const supabaseService = {
    deleteFile,
    getPublicUrl,
  } as unknown as SupabaseService;
  const getMeUseCase = { execute: getMeExecute } as unknown as GetMeUseCase;

  const useCase = new DeleteAvatarUseCase(
    userRepository,
    supabaseService,
    getMeUseCase,
  );
  const actor = { id: "user-1", authId: "auth-1" };
  const meResponse = { user: {}, memberships: [] } as unknown as MeResponseDto;

  beforeEach(() => {
    jest.resetAllMocks();
    getPublicUrl.mockImplementation(
      (_bucket: string, path: string) => `${PUBLIC_PREFIX}${path}`,
    );
    deleteFile.mockResolvedValue(undefined);
    update.mockResolvedValue({});
    getMeExecute.mockResolvedValue(meResponse);
  });

  it("sin foto responde OK sin llamar a Storage ni escribir", async () => {
    findUnique.mockResolvedValue({ id: "user-1", avatarUrl: null });

    const result = await useCase.execute(actor);

    expect(update).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
    expect(getMeExecute).toHaveBeenCalledWith("auth-1");
    expect(result).toBe(meResponse);
  });

  it("pone avatarUrl en null y borra el archivo", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      avatarUrl: `${PUBLIC_PREFIX}user-1/foto.png`,
    });

    const result = await useCase.execute(actor);

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatarUrl: null },
    });
    expect(deleteFile).toHaveBeenCalledWith("avatars", "user-1/foto.png");
    expect(result).toBe(meResponse);
  });

  it("si falla el borrado en Storage, responde OK igual", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      avatarUrl: `${PUBLIC_PREFIX}user-1/foto.png`,
    });
    deleteFile.mockRejectedValue(new Error("storage caído"));

    const result = await useCase.execute(actor);

    expect(update).toHaveBeenCalled();
    expect(result).toBe(meResponse);
  });

  it("no borra archivos de otra carpeta del bucket", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      avatarUrl: `${PUBLIC_PREFIX}user-2/foto.png`,
    });

    await useCase.execute(actor);

    expect(update).toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
