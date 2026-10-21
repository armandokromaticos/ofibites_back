import { InviteCompanyMemberUseCase } from "./invite-company-member.use-case";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import type { IUserRepository } from "../../../domain/repositories/user.repository.interface";
import type { IBranchRepository } from "../../../domain/repositories/branch.repository.interface";
import type { IDepartmentRepository } from "../../../domain/repositories/department.repository.interface";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import { CompanyMemberEntity } from "../../../domain/entities/company-member.entity";
import type { CompanyEntity } from "../../../domain/entities/company.entity";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { InviteCompanyMemberDto } from "../../dto/company-members/invite-company-member.dto";

describe("InviteCompanyMemberUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const userId = "44444444-4444-4444-4444-444444444444";
  const authId = "auth-123";

  const findUniqueCompany = jest.fn();
  const findUniqueUser = jest.fn();
  const createUser = jest.fn();
  const createMember = jest.fn();
  const inviteUserByEmail = jest.fn();

  const companyRepository = {
    findUnique: findUniqueCompany,
  } as unknown as ICompanyRepository;
  const userRepository = {
    findUnique: findUniqueUser,
    create: createUser,
  } as unknown as IUserRepository;
  const memberRepository = {
    create: createMember,
  } as unknown as ICompanyMemberRepository;
  const branchRepository = {} as unknown as IBranchRepository;
  const departmentRepository = {} as unknown as IDepartmentRepository;
  const supabaseService = {
    getAdmin: () => ({ auth: { admin: { inviteUserByEmail } } }),
  } as unknown as SupabaseService;

  let useCase: InviteCompanyMemberUseCase;

  beforeEach(() => {
    findUniqueCompany.mockReset();
    findUniqueUser.mockReset();
    createUser.mockReset();
    createMember.mockReset();
    inviteUserByEmail.mockReset();
    useCase = new InviteCompanyMemberUseCase(
      memberRepository,
      companyRepository,
      userRepository,
      branchRepository,
      departmentRepository,
      supabaseService,
    );
  });

  it("completa name/email/phone en la respuesta con el User recién creado", async () => {
    findUniqueCompany.mockResolvedValue({
      id: companyId,
    } as unknown as CompanyEntity);
    findUniqueUser.mockResolvedValue(null);
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: authId } },
      error: null,
    });
    createUser.mockResolvedValue({
      id: userId,
      authId,
      email: "juan.perez@diageo.com",
      name: "Juan Perez",
      phone: "+584141234567",
    });
    const createdMember = new CompanyMemberEntity();
    createdMember.id = "member-1";
    createdMember.userId = userId;
    createdMember.companyId = companyId;
    createdMember.role = CompanyRole.COMPANY_BUYER;
    createdMember.position = null;
    createdMember.branchId = null;
    createdMember.departmentId = null;
    createdMember.canPayInvoices = false;
    createdMember.isActive = true;
    createdMember.lastSeenAt = null;
    createdMember.createdAt = new Date();
    createdMember.updatedAt = new Date();
    createMember.mockResolvedValue(createdMember);

    const dto = new InviteCompanyMemberDto();
    dto.name = "Juan Perez";
    dto.email = "juan.perez@diageo.com";
    dto.phone = "+584141234567";
    dto.role = CompanyRole.COMPANY_BUYER;

    const result = await useCase.execute(companyId, dto);

    expect(result.userName).toBe("Juan Perez");
    expect(result.userEmail).toBe("juan.perez@diageo.com");
    expect(result.userPhone).toBe("+584141234567");
  });
});
