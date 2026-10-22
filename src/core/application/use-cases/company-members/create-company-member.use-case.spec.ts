import { CreateCompanyMemberUseCase } from "./create-company-member.use-case";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import type { UserEntity } from "../../../domain/entities/user.entity";
import type { CompanyEntity } from "../../../domain/entities/company.entity";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { CreateCompanyMemberDto } from "../../dto/company-members/create-company-member.dto";

describe("CreateCompanyMemberUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const userId = "33333333-3333-3333-3333-333333333333";

  const findUniqueCompany = jest.fn();
  const findUniqueUser = jest.fn();
  const create = jest.fn();

  const companyRepository = {
    findUnique: findUniqueCompany,
  } as unknown as ICompanyRepository;
  const userRepository = {
    findUnique: findUniqueUser,
  } as unknown as IUserRepository;
  const memberRepository = { create } as unknown as ICompanyMemberRepository;
  const branchRepository = {} as unknown as IBranchRepository;
  const departmentRepository = {} as unknown as IDepartmentRepository;

  let useCase: CreateCompanyMemberUseCase;

  beforeEach(() => {
    findUniqueCompany.mockReset();
    findUniqueUser.mockReset();
    create.mockReset();
    useCase = new CreateCompanyMemberUseCase(
      memberRepository,
      companyRepository,
      userRepository,
      branchRepository,
      departmentRepository,
    );
  });

  it("completa name/email/phone con el User ya buscado, sin pedir include al repositorio", async () => {
    findUniqueCompany.mockResolvedValue({
      id: companyId,
    } as unknown as CompanyEntity);
    const user = {
      id: userId,
      name: "Juan Pérez",
      email: "juan@diageo.com",
      phone: "+584141234567",
    } as unknown as UserEntity;
    findUniqueUser.mockResolvedValue(user);
    const created = new CompanyMemberEntity();
    created.id = "member-1";
    created.userId = userId;
    created.companyId = companyId;
    created.role = CompanyRole.COMPANY_BUYER;
    created.position = null;
    created.branchId = null;
    created.departmentId = null;
    created.canPayInvoices = false;
    created.isActive = true;
    created.lastSeenAt = null;
    created.createdAt = new Date();
    created.updatedAt = new Date();
    create.mockResolvedValue(created);

    const dto = new CreateCompanyMemberDto();
    dto.userId = userId;
    dto.role = CompanyRole.COMPANY_BUYER;

    const result = await useCase.execute(companyId, dto);

    expect(result.userName).toBe("Juan Pérez");
    expect(result.userEmail).toBe("juan@diageo.com");
    expect(result.userPhone).toBe("+584141234567");
  });
});
