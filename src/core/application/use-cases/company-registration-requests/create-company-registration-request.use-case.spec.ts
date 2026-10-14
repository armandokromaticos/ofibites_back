import { CreateCompanyRegistrationRequestUseCase } from "./create-company-registration-request.use-case";
import type { ICompanyRegistrationRequestRepository } from "../../../domain/repositories/company-registration-request.repository.interface";
import type { ICompanyRepository } from "../../../domain/repositories/company.repository.interface";
import { CompanyRegistrationRequestEntity } from "../../../domain/entities/company-registration-request.entity";
import { CreateCompanyRegistrationRequestDto } from "../../dto/company-registration-requests/create-company-registration-request.dto";
import { RegistrationSolution } from "../../../domain/enums/registration-solution.enum";
import { OrderFrequency } from "../../../domain/enums/order-frequency.enum";
import { PeoplePerOrderRange } from "../../../domain/enums/people-per-order-range.enum";

describe("CreateCompanyRegistrationRequestUseCase", () => {
  const create = jest.fn((entity: CompanyRegistrationRequestEntity) =>
    Promise.resolve(entity),
  );
  const requestRepository = {
    create,
    exists: jest.fn().mockResolvedValue(false),
  } as unknown as ICompanyRegistrationRequestRepository;
  const companyRepository = {
    findUnique: jest.fn().mockResolvedValue(null),
  } as unknown as ICompanyRepository;

  const useCase = new CreateCompanyRegistrationRequestUseCase(
    requestRepository,
    companyRepository,
  );

  const dto: CreateCompanyRegistrationRequestDto = {
    legalName: "Diageo Venezuela C.A.",
    taxId: " J-12345678-9 ",
    contactName: "María Pérez",
    contactEmail: "Maria.Perez@Diageo.com",
    contactPhone: "+58 412 555 0000",
    generalNeed: "Coffee break para reuniones.",
    interestedSolutions: [
      RegistrationSolution.COFFEE_BREAK,
      RegistrationSolution.BEVERAGES,
    ],
    orderFrequency: OrderFrequency.SEVERAL_TIMES_A_WEEK,
    peoplePerOrder: PeoplePerOrderRange.FROM_26_TO_50,
  };

  beforeEach(() => create.mockClear());

  it("persiste las respuestas de necesidades", async () => {
    await useCase.execute(dto);

    const entity = create.mock.calls[0][0];
    expect(entity.toPrismaCreate()).toMatchObject({
      taxId: "J-12345678-9",
      contactEmail: "maria.perez@diageo.com",
      generalNeed: "Coffee break para reuniones.",
      interestedSolutions: ["COFFEE_BREAK", "BEVERAGES"],
      orderFrequency: "SEVERAL_TIMES_A_WEEK",
      peoplePerOrder: "FROM_26_TO_50",
      additionalComments: null,
    });
  });

  it("guarda los comentarios adicionales cuando llegan", async () => {
    await useCase.execute({ ...dto, additionalComments: "Sin gluten." });

    expect(create.mock.calls[0][0].additionalComments).toBe("Sin gluten.");
  });
});
