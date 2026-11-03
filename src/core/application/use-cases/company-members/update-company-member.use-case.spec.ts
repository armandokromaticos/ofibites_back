import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { UpdateCompanyMemberUseCase } from "./update-company-member.use-case";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import type { UserEntity } from "../../../domain/entities/user.entity";
import { CompanyRole } from "../../../domain/enums/company-role.enum";

describe("UpdateCompanyMemberUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const memberId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";
  const adminUserId = "44444444-4444-4444-4444-444444444444";

  const findUniqueMember = jest.fn();
  const updateMember = jest.fn();
  const findUniqueUser = jest.fn();
  const updateUser = jest.fn();

  const memberRepository = {
    findUnique: findUniqueMember,
    update: updateMember,
  } as unknown as ICompanyMemberRepository;
  const branchRepository = {} as unknown as IBranchRepository;
  const departmentRepository = {} as unknown as IDepartmentRepository;
  const userRepository = {
    findUnique: findUniqueUser,
    update: updateUser,
  } as unknown as IUserRepository;

  let useCase: UpdateCompanyMemberUseCase;

  const existingMember = (() => {
    const entity = new CompanyMemberEntity();
    entity.id = memberId;
    entity.userId = userId;
    entity.companyId = companyId;
    entity.role = CompanyRole.COMPANY_BUYER;
    entity.position = null;
    entity.branchId = null;
    entity.departmentId = null;
    entity.canPayInvoices = false;
    entity.isActive = true;
    entity.lastSeenAt = null;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  })();

  const currentUser = {
    id: userId,
    name: "María Pérez",
    email: "maria@diageo.com",
    phone: "+584141234567",
  } as unknown as UserEntity;

  beforeEach(() => {
    findUniqueMember.mockReset();
    updateMember.mockReset();
    findUniqueUser.mockReset();
    updateUser.mockReset();
    useCase = new UpdateCompanyMemberUseCase(
      memberRepository,
      branchRepository,
      departmentRepository,
      userRepository,
    );
  });

  it("lanza 400 si no viene ningún campo", async () => {
    await expect(
      useCase.execute(companyId, memberId, {}, adminUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findUniqueMember).not.toHaveBeenCalled();
  });

  it("lanza 404 si el miembro no existe o es de otra empresa", async () => {
    findUniqueMember.mockResolvedValue(null);

    await expect(
      useCase.execute(
        companyId,
        memberId,
        { role: CompanyRole.COMPANY_ADMIN },
        adminUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("actualiza el CompanyMember y completa name/email/phone buscando el User cuando no se tocó", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    const updated = CompanyMemberEntity.fromPrisma({
      ...existingMember,
      role: CompanyRole.COMPANY_ADMIN,
    });
    updateMember.mockResolvedValue(updated);
    findUniqueUser.mockResolvedValue(currentUser);

    const result = await useCase.execute(
      companyId,
      memberId,
      { role: CompanyRole.COMPANY_ADMIN },
      adminUserId,
    );

    expect(updateUser).not.toHaveBeenCalled();
    expect(findUniqueUser).toHaveBeenCalledWith({ where: { id: userId } });
    expect(result.userName).toBe("María Pérez");
    expect(result.userEmail).toBe("maria@diageo.com");
    expect(result.userPhone).toBe("+584141234567");
  });

  it("actualiza User.name/phone cuando vienen en el dto y no vuelve a buscar el User", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    updateMember.mockResolvedValue(
      CompanyMemberEntity.fromPrisma(existingMember),
    );
    const updatedUser = {
      ...currentUser,
      name: "María Pérez Rodríguez",
      phone: "+584141230000",
    } as unknown as UserEntity;
    updateUser.mockResolvedValue(updatedUser);

    const result = await useCase.execute(
      companyId,
      memberId,
      { name: "María Pérez Rodríguez", phone: "+584141230000" },
      adminUserId,
    );

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "María Pérez Rodríguez", phone: "+584141230000" },
    });
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect(result.userName).toBe("María Pérez Rodríguez");
    expect(result.userPhone).toBe("+584141230000");
  });

  it("lanza 400 si name viene en null (User.name es NOT NULL)", async () => {
    findUniqueMember.mockResolvedValue(existingMember);

    await expect(
      useCase.execute(
        companyId,
        memberId,
        { name: null as unknown as string },
        adminUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateUser).not.toHaveBeenCalled();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("permite poner phone en null explícito", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    updateMember.mockResolvedValue(
      CompanyMemberEntity.fromPrisma(existingMember),
    );
    updateUser.mockResolvedValue({ ...currentUser, phone: null });

    await useCase.execute(companyId, memberId, { phone: null }, adminUserId);

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phone: null },
    });
  });

  it("lanza 403 si el usuario intenta desactivar su propia membresía, sin escribir nada", async () => {
    findUniqueMember.mockResolvedValue(existingMember);

    const promesa = useCase.execute(
      companyId,
      memberId,
      { isActive: false },
      userId,
    );
    await expect(promesa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promesa).rejects.toThrow(
      "No puedes desactivar tu propia cuenta.",
    );
    expect(updateMember).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("permite desactivar a otro miembro", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    updateMember.mockResolvedValue(
      CompanyMemberEntity.fromPrisma({ ...existingMember, isActive: false }),
    );
    findUniqueUser.mockResolvedValue(currentUser);

    const result = await useCase.execute(
      companyId,
      memberId,
      { isActive: false },
      adminUserId,
    );

    expect(updateMember).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it("permite isActive: true sobre la propia membresía", async () => {
    findUniqueMember.mockResolvedValue(existingMember);
    updateMember.mockResolvedValue(
      CompanyMemberEntity.fromPrisma(existingMember),
    );
    findUniqueUser.mockResolvedValue(currentUser);

    await useCase.execute(companyId, memberId, { isActive: true }, userId);

    expect(updateMember).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { isActive: true },
    });
  });
});
