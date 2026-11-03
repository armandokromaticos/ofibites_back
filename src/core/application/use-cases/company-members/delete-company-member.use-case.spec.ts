import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeleteCompanyMemberUseCase } from "./delete-company-member.use-case";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import { CompanyRole } from "../../../domain/enums/company-role.enum";

describe("DeleteCompanyMemberUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const memberId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";
  const adminUserId = "44444444-4444-4444-4444-444444444444";

  const findUniqueMember = jest.fn();
  const deleteMember = jest.fn();

  const memberRepository = {
    findUnique: findUniqueMember,
    delete: deleteMember,
  } as unknown as ICompanyMemberRepository;

  let useCase: DeleteCompanyMemberUseCase;

  const existingMember = (() => {
    const entity = new CompanyMemberEntity();
    entity.id = memberId;
    entity.userId = userId;
    entity.companyId = companyId;
    entity.role = CompanyRole.COMPANY_ADMIN;
    entity.isActive = true;
    return entity;
  })();

  beforeEach(() => {
    findUniqueMember.mockReset();
    deleteMember.mockReset();
    useCase = new DeleteCompanyMemberUseCase(memberRepository);
  });

  it("lanza 404 si el miembro no existe o es de otra empresa", async () => {
    findUniqueMember.mockResolvedValue(null);

    await expect(
      useCase.execute(companyId, memberId, adminUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("lanza 403 si el usuario intenta eliminar su propia membresía, sin borrar nada", async () => {
    findUniqueMember.mockResolvedValue(existingMember);

    const promesa = useCase.execute(companyId, memberId, userId);
    await expect(promesa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promesa).rejects.toThrow(
      "No puedes eliminar tu propia cuenta.",
    );
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("elimina a otro miembro", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    deleteMember.mockResolvedValue(undefined);

    await useCase.execute(companyId, memberId, adminUserId);

    expect(deleteMember).toHaveBeenCalledWith(memberId);
  });
});
