import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

// La entidad sale de la caché de membresías (AuthUserCacheService) y se
// comparte entre requests: es de solo lectura y solo garantiza `role` e
// `isActive` al día; `branchId`/`departmentId` pueden ir hasta 30 s atrás.
export const CurrentCompanyMember = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext) => {
    const request = executionContext.switchToHttp().getRequest<Request>();
    return request["companyMember"];
  },
);
