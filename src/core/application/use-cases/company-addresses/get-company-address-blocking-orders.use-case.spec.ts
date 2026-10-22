import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GetCompanyAddressBlockingOrdersUseCase } from "./get-company-address-blocking-orders.use-case";
import type { ICompanyAddressRepository } from "../../../domain/repositories/company-address.repository.interface";
import type { ICompanyMemberRepository } from "../../../domain/repositories/company-member.repository.interface";
import type { IOrderRepository } from "../../../domain/repositories/order.repository.interface";
import { CompanyAddressEntity } from "../../../domain/entities/company-address.entity";
import type { OrderEntity } from "../../../domain/entities/order.entity";
import { OrderStatus } from "../../../domain/enums/order-status.enum";
import { Role } from "../../../domain/enums/role.enum";
import { ORDER_IN_PROGRESS_STATUSES } from "../../../domain/services/order-status-groups";

describe("GetCompanyAddressBlockingOrdersUseCase", () => {
  const companyId = "11111111-1111-1111-1111-111111111111";
  const addressId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  const findUniqueAddress = jest.fn();
  const findActiveByUserAndCompany = jest.fn();
  const findManyOrders = jest.fn();

  const addressRepository = {
    findUnique: findUniqueAddress,
  } as unknown as ICompanyAddressRepository;
  const companyMemberRepository = {
    findActiveByUserAndCompany,
  } as unknown as ICompanyMemberRepository;
  const orderRepository = {
    findMany: findManyOrders,
  } as unknown as IOrderRepository;

  let useCase: GetCompanyAddressBlockingOrdersUseCase;

  function address(overrides: Partial<CompanyAddressEntity> = {}) {
    const entity = new CompanyAddressEntity();
    Object.assign(entity, {
      id: addressId,
      companyId,
      label: "Sede Caracas",
      ...overrides,
    });
    return entity;
  }

  function order(overrides: Partial<OrderEntity> = {}) {
    return {
      id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      deliveryAddressId: addressId,
      deliveryDate: new Date("2026-10-09T00:00:00.000Z"),
      status: OrderStatus.CONFIRMED,
      orderNumber: "OF-2026-0007",
      ...overrides,
    } as unknown as OrderEntity;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueAddress.mockResolvedValue(address());
    findActiveByUserAndCompany.mockResolvedValue({ id: "member-1" });
    findManyOrders.mockResolvedValue({ data: [] });
    useCase = new GetCompanyAddressBlockingOrdersUseCase(
      addressRepository,
      companyMemberRepository,
      orderRepository,
    );
  });

  it("lanza 404 si la dirección no existe o es de otra empresa", async () => {
    findUniqueAddress.mockResolvedValue(null);
    await expect(
      useCase.execute(companyId, addressId, userId, Role.CLIENT),
    ).rejects.toBeInstanceOf(NotFoundException);

    findUniqueAddress.mockResolvedValue(address({ companyId: "otra-empresa" }));
    await expect(
      useCase.execute(companyId, addressId, userId, Role.CLIENT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lanza 403 si el CLIENT no pertenece a la empresa", async () => {
    findActiveByUserAndCompany.mockResolvedValue(null);
    await expect(
      useCase.execute(companyId, addressId, userId, Role.CLIENT),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findManyOrders).not.toHaveBeenCalled();
  });

  it("sin pedidos en curso devuelve lista vacía", async () => {
    const result = await useCase.execute(
      companyId,
      addressId,
      userId,
      Role.CLIENT,
    );
    expect(result).toEqual([]);
  });

  it("con un pedido en curso devuelve orderNumber y deliveryDate ISO", async () => {
    findManyOrders.mockResolvedValue({ data: [order()] });

    const result = await useCase.execute(
      companyId,
      addressId,
      userId,
      Role.CLIENT,
    );

    expect(result).toEqual([
      { orderNumber: "OF-2026-0007", deliveryDate: "2026-10-09T00:00:00.000Z" },
    ]);
  });

  it("sin orderNumber cae al respaldo de los últimos 8 del id", async () => {
    findManyOrders.mockResolvedValue({
      data: [order({ orderNumber: null, id: "aaaaaaaa7728950e" })],
    });

    const result = await useCase.execute(
      companyId,
      addressId,
      userId,
      Role.CLIENT,
    );

    expect(result[0].orderNumber).toBe("7728950E");
  });

  it("deliveryDate null (pedido anterior al checkout) se devuelve como null", async () => {
    findManyOrders.mockResolvedValue({
      data: [order({ deliveryDate: null })],
    });

    const result = await useCase.execute(
      companyId,
      addressId,
      userId,
      Role.CLIENT,
    );

    expect(result[0].deliveryDate).toBeNull();
  });

  it("filtra por deliveryAddressId y por ORDER_IN_PROGRESS_STATUSES (sin estados terminales)", async () => {
    await useCase.execute(companyId, addressId, userId, Role.CLIENT);

    expect(findManyOrders).toHaveBeenCalledWith({
      where: {
        deliveryAddressId: addressId,
        status: { in: [...ORDER_IN_PROGRESS_STATUSES] },
      },
      orderBy: { deliveryDate: "asc" },
    });
    const statusesUsed = [...ORDER_IN_PROGRESS_STATUSES];
    expect(statusesUsed).not.toContain(OrderStatus.DELIVERED);
    expect(statusesUsed).not.toContain(OrderStatus.CANCELLED);
    expect(statusesUsed).not.toContain(OrderStatus.REJECTED);
  });
});
