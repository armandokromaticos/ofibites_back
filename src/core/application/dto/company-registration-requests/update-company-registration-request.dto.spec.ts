import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCompanyRegistrationRequestDto } from "./update-company-registration-request.dto";

async function invalidFields(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCompanyRegistrationRequestDto, payload);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property).sort() };
}

describe("UpdateCompanyRegistrationRequestDto", () => {
  it("acepta un PATCH vacío (todos los campos son opcionales)", async () => {
    expect((await invalidFields({})).fields).toEqual([]);
  });

  it.each([
    "legalName",
    "taxId",
    "contactName",
    "contactEmail",
    "contactPhone",
    "generalNeed",
    "interestedSolutions",
    "orderFrequency",
    "peoplePerOrder",
  ])(
    "rechaza %s: null (no se puede borrar un campo obligatorio)",
    async (field) => {
      expect((await invalidFields({ [field]: null })).fields).toEqual([field]);
    },
  );

  it("permite additionalComments: null para borrarlo", async () => {
    const { dto, fields } = await invalidFields({ additionalComments: null });
    expect(fields).toEqual([]);
    expect(dto.additionalComments).toBeNull();
  });

  it("acepta valores válidos de las necesidades", async () => {
    const { fields } = await invalidFields({
      generalNeed: "  Working lunch mensual  ",
      interestedSolutions: ["WORKING_LUNCH"],
      orderFrequency: "MONTHLY",
      peoplePerOrder: "MORE_THAN_100",
    });
    expect(fields).toEqual([]);
  });

  it("rechaza interestedSolutions vacío y enums inválidos", async () => {
    const { fields } = await invalidFields({
      interestedSolutions: [],
      orderFrequency: "YEARLY",
      peoplePerOrder: "FROM_0_TO_1",
    });
    expect(fields).toEqual([
      "interestedSolutions",
      "orderFrequency",
      "peoplePerOrder",
    ]);
  });
});
