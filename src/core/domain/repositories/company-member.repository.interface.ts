import { Prisma } from "@prisma/client";
import { CompanyMemberEntity } from "../entities/company-member.entity";
import { CompanyRole } from "../enums/company-role.enum";

export const COMPANY_MEMBER_REPOSITORY = Symbol("COMPANY_MEMBER_REPOSITORY");

export interface CompanyMembershipDetails {
  membershipId: string;
  companyId: string;
  companyName: string;
  companyIsActive: boolean;
  /** T-34a: onboarding de la empresa; null = pendiente. */
  companyOnboardingCompletedAt: Date | null;
  role: CompanyRole;
  position: string | null;
  branchId: string | null;
  branchName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  canPayInvoices: boolean;
  isActive: boolean;
}

export interface ICompanyMemberRepository {
  create(entity: CompanyMemberEntity): Promise<CompanyMemberEntity>;
  findUnique(
    args: Prisma.CompanyMemberFindUniqueArgs,
  ): Promise<CompanyMemberEntity | null>;
  findFirst(
    args: Prisma.CompanyMemberFindFirstArgs,
  ): Promise<CompanyMemberEntity | null>;
  findMany(
    args?: Prisma.CompanyMemberFindManyArgs,
  ): Promise<{ data: CompanyMemberEntity[]; total?: number }>;
  update(args: Prisma.CompanyMemberUpdateArgs): Promise<CompanyMemberEntity>;
  delete(id: string): Promise<void>;
  exists(args: Prisma.CompanyMemberCountArgs): Promise<boolean>;

  // Helpers de dominio (lecturas con shape compuesto / agregaciones)
  findActiveByUserAndCompany(
    userId: string,
    companyId: string,
  ): Promise<CompanyMemberEntity | null>;
  findAllByUserIdWithRefs(userId: string): Promise<CompanyMembershipDetails[]>;
  findAllByUserIdsWithRefs(
    userIds: string[],
  ): Promise<(CompanyMembershipDetails & { userId: string })[]>;
  findActiveCompanyIdsByUserId(userId: string): Promise<string[]>;
  findActiveByCompanyId(companyId: string): Promise<CompanyMemberEntity[]>;
  touchLastSeenIfStale(
    authId: string,
    companyId: string,
    debounceMs: number,
  ): Promise<void>;
}
