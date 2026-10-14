import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCompanyRegistrationRequestDto } from "./create-company-registration-request.dto";

const validPayload = {
  legalName: "Diageo Venezuela C.A.",
  taxId: "J-12345678-9",
  contactName: "María Pérez",
  contactEmail: "maria.perez@diageo.com",
  contactPhone: "+58 412 555 0000",
  generalNeed: "  Coffee break para reuniones de directorio.  ",
  interestedSolutions: ["COFFEE_BREAK", "SNACKS"],
  orderFrequency: "WEEKLY",
  peoplePerOrder: "FROM_11_TO_25",
  additionalComments: "  Sin gluten.  ",
};

function without(field: keyof typeof validPayload) {
  const payload: Record<string, unknown> = { ...validPayload };
  delete payload[field];
  return payload;
}

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCompanyRegistrationRequestDto, payload);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

describe("CreateCompanyRegistrationRequestDto (necesidades)", () => {
  it("acepta un payload válido y recorta los textos", async () => {
    const { dto, fields } = await errorsFor(validPayload);
    expect(fields).toEqual([]);
    expect(dto.generalNeed).toBe("Coffee break para reuniones de directorio.");
    expect(dto.additionalComments).toBe("Sin gluten.");
  });

  it("acepta la solicitud sin comentarios adicionales", async () => {
    const { fields } = await errorsFor(without("additionalComments"));
    expect(fields).toEqual([]);
  });

  it("rechaza interestedSolutions vacío", async () => {
    const { fields } = await errorsFor({
      ...validPayload,
      interestedSolutions: [],
    });
    expect(fields).toEqual(["interestedSolutions"]);
  });

  it("rechaza interestedSolutions con repetidos o valores fuera del enum", async () => {
    expect(
      (
        await errorsFor({
          ...validPayload,
          interestedSolutions: ["SNACKS", "SNACKS"],
        })
      ).fields,
    ).toEqual(["interestedSolutions"]);
    expect(
      (
        await errorsFor({
          ...validPayload,
          interestedSolutions: ["PIZZA"],
        })
      ).fields,
    ).toEqual(["interestedSolutions"]);
  });

  it("rechaza orderFrequency y peoplePerOrder inválidos o ausentes", async () => {
    expect((await errorsFor(without("orderFrequency"))).fields).toEqual([
      "orderFrequency",
    ]);
    expect(
      (await errorsFor({ ...validPayload, peoplePerOrder: "FROM_1_TO_5" }))
        .fields,
    ).toEqual(["peoplePerOrder"]);
  });

  it("rechaza generalNeed vacío tras el trim", async () => {
    const { fields } = await errorsFor({ ...validPayload, generalNeed: "   " });
    expect(fields).toEqual(["generalNeed"]);
  });

  it("rechaza textos por encima del máximo", async () => {
    const { fields } = await errorsFor({
      ...validPayload,
      generalNeed: "a".repeat(501),
      additionalComments: "b".repeat(1001),
    });
    expect(fields.sort()).toEqual(["additionalComments", "generalNeed"]);
  });
});
