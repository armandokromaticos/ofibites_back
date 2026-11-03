import { CompanyRegistrationRequestResponseDto } from "./company-registration-request-response.dto";
import { CompanyRegistrationRequestEntity } from "../../../domain/entities/company-registration-request.entity";

function entityCon(
  requestNumber: number,
  createdAt: Date,
): CompanyRegistrationRequestEntity {
  const entity = new CompanyRegistrationRequestEntity();
  entity.id = "req-1";
  entity.requestNumber = requestNumber;
  entity.interestedSolutions = [];
  entity.createdAt = createdAt;
  entity.updatedAt = createdAt;
  return entity;
}

describe("CompanyRegistrationRequestResponseDto.fromEntity (folio)", () => {
  it("expone requestNumber y el folio SOL-AAAA-NNNN", () => {
    const dto = CompanyRegistrationRequestResponseDto.fromEntity(
      entityCon(412, new Date("2026-11-03T15:00:00.000Z")),
    );
    expect(dto.requestNumber).toBe(412);
    expect(dto.folio).toBe("SOL-2026-0412");
  });

  it("el año del folio es el de Caracas, no el de UTC", () => {
    const dto = CompanyRegistrationRequestResponseDto.fromEntity(
      entityCon(7, new Date("2027-01-01T03:59:59.000Z")),
    );
    expect(dto.folio).toBe("SOL-2026-0007");
  });
});
