import type { PrismaService } from "../database/prisma/prisma.service";
import type { AuthUserCacheService } from "../cache/auth-user-cache.service";
import { UserRepository } from "./user.repository";

describe("UserRepository (invalidación de la caché de guards)", () => {
  const prisma = {
    user: {
      delete: jest.fn().mockResolvedValue({ id: "user-1", authId: "auth-1" }),
    },
  } as unknown as PrismaService;
  const invalidar = jest.fn();
  const repo = new UserRepository(prisma, {
    invalidar,
  } as unknown as AuthUserCacheService);

  it("al borrar un usuario invalida su entrada por authId", async () => {
    await repo.delete("user-1");

    expect(invalidar).toHaveBeenCalledWith("auth-1");
  });
});
