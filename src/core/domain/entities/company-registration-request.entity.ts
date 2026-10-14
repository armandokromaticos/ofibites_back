import {
  CompanyRegistrationRequest as PrismaCompanyRegistrationRequest,
  Prisma,
} from "@prisma/client";
import { RegistrationRequestStatus } from "../enums/registration-request-status.enum";
import { RegistrationSolution } from "../enums/registration-solution.enum";
import { OrderFrequency } from "../enums/order-frequency.enum";
import { PeoplePerOrderRange } from "../enums/people-per-order-range.enum";

function assertEnumValue<T extends Record<string, string>>(
  enumObject: T,
  enumName: string,
  value: string,
): T[keyof T] {
  if (!Object.values(enumObject).includes(value)) {
    throw new Error(`Invalid ${enumName} value: ${value}`);
  }
  return value as T[keyof T];
}

export interface CreateCompanyRegistrationRequestParams {
  legalName: string;
  taxId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  position?: string | null;
  employeeCount?: number | null;
  generalNeed: string;
  interestedSolutions: RegistrationSolution[];
  orderFrequency: OrderFrequency;
  peoplePerOrder: PeoplePerOrderRange;
  additionalComments?: string | null;
}

export class CompanyRegistrationRequestEntity {
  id: string;
  legalName: string;
  taxId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  position: string | null;
  employeeCount: number | null;
  /** Necesidades del cliente (paso 3 del registro). Null en solicitudes anteriores. */
  generalNeed: string | null;
  interestedSolutions: RegistrationSolution[];
  orderFrequency: OrderFrequency | null;
  peoplePerOrder: PeoplePerOrderRange | null;
  additionalComments: string | null;
  status: RegistrationRequestStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  approvedCompanyId: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromPrisma(
    prisma: PrismaCompanyRegistrationRequest,
  ): CompanyRegistrationRequestEntity {
    const entity = new CompanyRegistrationRequestEntity();
    entity.id = prisma.id;
    entity.legalName = prisma.legalName;
    entity.taxId = prisma.taxId;
    entity.contactName = prisma.contactName;
    entity.contactEmail = prisma.contactEmail;
    entity.contactPhone = prisma.contactPhone;
    entity.position = prisma.position;
    entity.employeeCount = prisma.employeeCount;
    entity.generalNeed = prisma.generalNeed;
    entity.interestedSolutions = (prisma.interestedSolutions ?? []).map(
      (value) =>
        assertEnumValue(RegistrationSolution, "RegistrationSolution", value),
    );
    entity.orderFrequency =
      prisma.orderFrequency === null
        ? null
        : assertEnumValue(
            OrderFrequency,
            "OrderFrequency",
            prisma.orderFrequency,
          );
    entity.peoplePerOrder =
      prisma.peoplePerOrder === null
        ? null
        : assertEnumValue(
            PeoplePerOrderRange,
            "PeoplePerOrderRange",
            prisma.peoplePerOrder,
          );
    entity.additionalComments = prisma.additionalComments;
    if (
      !Object.values(RegistrationRequestStatus).includes(
        prisma.status as RegistrationRequestStatus,
      )
    ) {
      throw new Error(
        `Invalid RegistrationRequestStatus value: ${prisma.status}`,
      );
    }
    entity.status = prisma.status as RegistrationRequestStatus;
    entity.rejectionReason = prisma.rejectionReason;
    entity.reviewedAt = prisma.reviewedAt;
    entity.reviewedById = prisma.reviewedById;
    entity.approvedCompanyId = prisma.approvedCompanyId;
    entity.createdAt = prisma.createdAt;
    entity.updatedAt = prisma.updatedAt;
    return entity;
  }

  static fromCreateParams(
    params: CreateCompanyRegistrationRequestParams,
  ): CompanyRegistrationRequestEntity {
    const entity = new CompanyRegistrationRequestEntity();
    entity.id = "";
    entity.legalName = params.legalName.trim();
    entity.taxId = params.taxId.trim();
    entity.contactName = params.contactName.trim();
    entity.contactEmail = params.contactEmail.trim().toLowerCase();
    entity.contactPhone = params.contactPhone.trim();
    entity.position = params.position?.trim() || null;
    entity.employeeCount = params.employeeCount ?? null;
    entity.generalNeed = params.generalNeed.trim();
    entity.interestedSolutions = [...new Set(params.interestedSolutions)];
    entity.orderFrequency = params.orderFrequency;
    entity.peoplePerOrder = params.peoplePerOrder;
    entity.additionalComments = params.additionalComments?.trim() || null;
    entity.status = RegistrationRequestStatus.PENDING;
    entity.rejectionReason = null;
    entity.reviewedAt = null;
    entity.reviewedById = null;
    entity.approvedCompanyId = null;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  toPrismaCreate(): Prisma.CompanyRegistrationRequestCreateInput {
    return {
      legalName: this.legalName,
      taxId: this.taxId,
      contactName: this.contactName,
      contactEmail: this.contactEmail,
      contactPhone: this.contactPhone,
      position: this.position,
      employeeCount: this.employeeCount,
      generalNeed: this.generalNeed,
      interestedSolutions: this.interestedSolutions,
      orderFrequency: this.orderFrequency,
      peoplePerOrder: this.peoplePerOrder,
      additionalComments: this.additionalComments,
      status: this.status,
    };
  }
}
