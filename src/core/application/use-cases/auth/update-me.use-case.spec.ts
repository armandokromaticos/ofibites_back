import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UpdateMeUseCase } from "./update-me.use-case";
import type { GetMeUseCase } from "./get-me.use-case";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { MeResponseDto } from "../../dto/auth/me-response.dto";

describe("UpdateMeUseCase", () => {
  const userUpdate = jest.fn();
  const memberUpdate = jest.fn();
  const findActiveByUserAndCompany = jest.fn();
  const getMeExecute = jest.fn();

  const userRepository = { update: userUpdate } as unknown as IUserRepository;
  const memberRepository = {
    update: memberUpdate,
    findActiveByUserAndCompany,
  } as unknown as ICompanyMemberRepository;
  const getMeUseCase = { execute: getMeExecute } as unknown as GetMeUseCase;

  const useCase = new UpdateMeUseCase(
    userRepository,
    memberRepository,
    getMeUseCase,
  );
  const actor = { id: "user-1", authId: "auth-1" };
  const companyId = "11111111-1111-4111-8111-111111111111";
  const meResponse = { user: {}, memberships: [] } as unknown as MeResponseDto;

  beforeEach(() => {
    jest.resetAllMocks();
    userUpdate.mockResolvedValue({});
    memberUpdate.mockResolvedValue({});
    findActiveByUserAndCompany.mockResolvedValue({ id: "member-1" });
    getMeExecute.mockResolvedValue(meResponse);
  });

  it("responde 400 si el cuerpo no trae ningún campo", async () => {
    await expect(useCase.execute(actor, {}, companyId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userUpdate).not.toHaveBeenCalled();
    expect(memberUpdate).not.toHaveBeenCalled();
  });

  it("responde 400 si viene position sin X-Company-Id, sin escribir nada", async () => {
    await expect(
      useCase.execute(actor, { name: "Ana", position: "Gerente" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(memberUpdate).not.toHaveBeenCalled();
  });

  it("responde 403 si no hay membresía activa en la empresa", async () => {
    findActiveByUserAndCompany.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, { position: "Gerente" }, companyId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findActiveByUserAndCompany).toHaveBeenCalledWith(
      "user-1",
      companyId,
    );
    expect(memberUpdate).not.toHaveBeenCalled();
  });

  it("actualiza nombre y teléfono del User sin tocar la membresía", async () => {
    const result = await useCase.execute(actor, {
      name: "María Pérez",
      phone: null,
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "María Pérez", phone: null },
    });
    expect(findActiveByUserAndCompany).not.toHaveBeenCalled();
    expect(memberUpdate).not.toHaveBeenCalled();
    expect(getMeExecute).toHaveBeenCalledWith("auth-1");
    expect(result).toBe(meResponse);
  });

  it("actualiza el cargo de la membresía activa y devuelve /auth/me", async () => {
    const result = await useCase.execute(
      actor,
      { position: "Gerente de compras" },
      companyId,
    );

    expect(userUpdate).not.toHaveBeenCalled();
    expect(memberUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { position: "Gerente de compras" },
    });
    expect(result).toBe(meResponse);
  });

  it("position null borra el cargo", async () => {
    await useCase.execute(actor, { position: null }, companyId);

    expect(memberUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { position: null },
    });
  });
});
