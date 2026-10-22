import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UploadAvatarUseCase } from "./upload-avatar.use-case";
import type { GetMeUseCase } from "./get-me.use-case";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import type { MeResponseDto } from "../../dto/auth/me-response.dto";

const PUBLIC_PREFIX =
  "https://proyecto.supabase.co/storage/v1/object/public/avatars/";
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("UploadAvatarUseCase", () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const uploadFile = jest.fn();
  const deleteFile = jest.fn();
  const getPublicUrl = jest.fn();
  const getMeExecute = jest.fn();

  const userRepository = { findUnique, update } as unknown as IUserRepository;
  const supabaseService = {
    uploadFile,
    deleteFile,
    getPublicUrl,
  } as unknown as SupabaseService;
  const getMeUseCase = { execute: getMeExecute } as unknown as GetMeUseCase;

  const useCase = new UploadAvatarUseCase(
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
    uploadFile.mockImplementation(
      (_bucket: string, path: string) => `${PUBLIC_PREFIX}${path}`,
    );
    deleteFile.mockResolvedValue(undefined);
    findUnique.mockResolvedValue({
      id: "user-1",
      avatarUrl: `${PUBLIC_PREFIX}user-1/vieja.png`,
    });
    update.mockResolvedValue({});
    getMeExecute.mockResolvedValue(meResponse);
  });

  it("responde 400 si no llega archivo", async () => {
    await expect(useCase.execute(actor, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("responde 400 si el formato no está permitido", async () => {
    await expect(
      useCase.execute(actor, {
        buffer: PNG_BYTES,
        mimetype: "image/webp",
        size: PNG_BYTES.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("responde 400 si los bytes no son imagen aunque el mimetype diga png", async () => {
    const fake = Buffer.from("<script>alert(1)</script>");
    await expect(
      useCase.execute(actor, {
        buffer: fake,
        mimetype: "image/png",
        size: fake.length,
      }),
    ).rejects.toThrow("El archivo no es una imagen JPG o PNG válida");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("responde 400 si supera los 2.000.000 bytes", async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2_000_000)]);
    await expect(
      useCase.execute(actor, {
        buffer: big,
        mimetype: "image/png",
        size: big.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("sube a <userId>/<uuid>.<ext>, guarda la URL y borra la anterior", async () => {
    const result = await useCase.execute(actor, {
      buffer: JPEG_BYTES,
      mimetype: "image/jpeg",
      size: JPEG_BYTES.length,
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    const [bucket, path, buffer, contentType] = uploadFile.mock.calls[0] as [
      string,
      string,
      Buffer,
      string,
    ];
    expect(bucket).toBe("avatars");
    expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
    expect(buffer).toBe(JPEG_BYTES);
    expect(contentType).toBe("image/jpeg");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1", avatarUrl: `${PUBLIC_PREFIX}user-1/vieja.png` },
      data: { avatarUrl: `${PUBLIC_PREFIX}${path}` },
    });
    expect(deleteFile).toHaveBeenCalledWith("avatars", "user-1/vieja.png");
    expect(getMeExecute).toHaveBeenCalledWith("auth-1");
    expect(result).toBe(meResponse);
  });

  it("si falla el borrado de la anterior, responde igual", async () => {
    deleteFile.mockRejectedValue(new Error("storage caído"));

    const result = await useCase.execute(actor, {
      buffer: PNG_BYTES,
      mimetype: "image/png",
      size: PNG_BYTES.length,
    });

    expect(update).toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledWith("avatars", "user-1/vieja.png");
    expect(result).toBe(meResponse);
  });

  it("no borra la anterior si no es del bucket avatars", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      avatarUrl: "https://otro.cdn.com/foto.png",
    });

    await useCase.execute(actor, {
      buffer: PNG_BYTES,
      mimetype: "image/png",
      size: PNG_BYTES.length,
    });

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("responde 503 si Storage falla al subir, sin tocar la BD", async () => {
    uploadFile.mockRejectedValue(new Error("timeout"));

    await expect(
      useCase.execute(actor, {
        buffer: PNG_BYTES,
        mimetype: "image/png",
        size: PNG_BYTES.length,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(update).not.toHaveBeenCalled();
  });

  it("si falla guardar la URL, borra el archivo recién subido y propaga el error", async () => {
    update.mockRejectedValue(new Error("db caída"));

    await expect(
      useCase.execute(actor, {
        buffer: PNG_BYTES,
        mimetype: "image/png",
        size: PNG_BYTES.length,
      }),
    ).rejects.toThrow("db caída");
    const [, newPath] = uploadFile.mock.calls[0] as [string, string];
    expect(deleteFile).toHaveBeenCalledWith("avatars", newPath);
    expect(deleteFile).not.toHaveBeenCalledWith("avatars", "user-1/vieja.png");
  });

  it("si otra subida ganó la carrera (P2025), responde 409, borra el archivo recién subido y no toca la anterior", async () => {
    const raceError = new Prisma.PrismaClientKnownRequestError(
      "An operation failed because it depends on one or more records that were required but not found.",
      { code: "P2025", clientVersion: "test" },
    );
    update.mockRejectedValue(raceError);

    await expect(
      useCase.execute(actor, {
        buffer: PNG_BYTES,
        mimetype: "image/png",
        size: PNG_BYTES.length,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const [, newPath] = uploadFile.mock.calls[0] as [string, string];
    expect(deleteFile).toHaveBeenCalledWith("avatars", newPath);
    expect(deleteFile).not.toHaveBeenCalledWith("avatars", "user-1/vieja.png");
    expect(getMeExecute).not.toHaveBeenCalled();
  });
});
