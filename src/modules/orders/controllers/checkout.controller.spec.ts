import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { CheckoutController } from "./checkout.controller";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { CheckoutOrderUseCase } from "../../../core/application/use-cases/orders/checkout-order.use-case";
import { USER_REPOSITORY } from "../../../core/domain/repositories/user.repository.interface";
import { COMPANY_MEMBER_REPOSITORY } from "../../../core/domain/repositories/company-member.repository.interface";
import { ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { OrdersController } from "./orders.controller";
import { Role } from "../../../core/domain/enums/role.enum";
import {
  checkoutConflict,
  CheckoutErrorCode,
} from "../../../core/application/shared/checkout-errors";

const COMPANY_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BODY = {
  deliveryAddressId: "9b2f0b8e-5a8f-4a39-9d0e-2a5f8f4c1e11",
  deliveryDate: "2026-10-20",
  deliveryTime: "10:30",
  receiverName: "María Pérez",
  receiverPhone: "+58 412-555-1234",
};

// Rutas, validación y PlatformOrCompanyRoleGuard reales; Jwt y use-case simulados.
describe("CheckoutController (HTTP)", () => {
  let app: INestApplication<App>;
  /** Usuario de BD que verá el guard en cada test. */
  let dbUser: { id: string; role: Role; isActive: boolean };
  /** Membresía activa que devolverá el repositorio (null = no es miembro). */
  let member: { role: string } | null;

  const checkout = {
    execute: jest.fn(() =>
      Promise.resolve({ toResponseDto: () => ({ id: "order-1" }) }),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        Reflector,
        PlatformOrCompanyRoleGuard,
        { provide: CheckoutOrderUseCase, useValue: checkout },
        {
          provide: USER_REPOSITORY,
          useValue: { findUnique: jest.fn(() => Promise.resolve(dbUser)) },
        },
        {
          provide: COMPANY_MEMBER_REPOSITORY,
          useValue: {
            findActiveByUserAndCompany: jest.fn(() => Promise.resolve(member)),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          ctx.switchToHttp().getRequest().user = { authId: "auth-1" };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbUser = { id: "user-1", role: Role.CLIENT, isActive: true };
    member = { role: "COMPANY_BUYER" };
  });

  const post = () => request(app.getHttpServer()).post("/orders/checkout");

  it("COMPANY_BUYER con X-Company-Id → 201 y llama al use-case con la empresa", async () => {
    await post().set("X-Company-Id", COMPANY_ID).send(BODY).expect(201);
    expect(checkout.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      { id: "user-1", role: Role.CLIENT },
      expect.objectContaining({ deliveryDate: "2026-10-20" }),
    );
  });

  it("cliente sin X-Company-Id → 400", async () => {
    await post().send(BODY).expect(400);
    expect(checkout.execute).not.toHaveBeenCalled();
  });

  it("plataforma sin X-Company-Id → 400 en español", async () => {
    dbUser = { id: "admin-1", role: Role.SUPER_ADMIN, isActive: true };
    const res = await post().send(BODY).expect(400);
    expect((res.body as { message: string }).message).toBe(
      "X-Company-Id es requerido",
    );
  });

  it("X-Company-Id que no es UUID → 400", async () => {
    dbUser = { id: "admin-1", role: Role.SUPER_ADMIN, isActive: true };
    const res = await post()
      .set("X-Company-Id", "no-es-uuid")
      .send(BODY)
      .expect(400);
    expect((res.body as { message: string }).message).toBe(
      "X-Company-Id debe ser un UUID válido",
    );
    expect(checkout.execute).not.toHaveBeenCalled();
  });

  it.each(["COMPANY_FINANCE", "COMPANY_APPROVER"])(
    "rol de empresa sin acceso (%s) → 403",
    async (role) => {
      member = { role };
      await post().set("X-Company-Id", COMPANY_ID).send(BODY).expect(403);
      expect(checkout.execute).not.toHaveBeenCalled();
    },
  );

  it("no miembro de la empresa → 403", async () => {
    member = null;
    await post().set("X-Company-Id", COMPANY_ID).send(BODY).expect(403);
  });

  it("OPERATOR de plataforma (sin acceso al carrito) → 403", async () => {
    dbUser = { id: "op-1", role: Role.OPERATOR, isActive: true };
    member = null;
    await post().set("X-Company-Id", COMPANY_ID).send(BODY).expect(403);
  });

  it("los errores de negocio llegan por HTTP con su code (sin filtro propio)", async () => {
    checkout.execute.mockRejectedValueOnce(
      checkoutConflict(CheckoutErrorCode.CART_CHANGED, "El carrito cambió"),
    );
    const res = await post()
      .set("X-Company-Id", COMPANY_ID)
      .send(BODY)
      .expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: "El carrito cambió",
      code: "CART_CHANGED",
    });
  });

  it("body inválido → 400 sin llamar al use-case", async () => {
    await post()
      .set("X-Company-Id", COMPANY_ID)
      .send({ ...BODY, receiverPhone: "123" })
      .expect(400);
    expect(checkout.execute).not.toHaveBeenCalled();
  });
});

describe("OrdersController · crear pedidos solo plataforma (decisión 2026-10-16)", () => {
  const rolesOf = (method: "createOrder" | "repeatOrder"): Role[] =>
    Reflect.getMetadata(
      ROLES_KEY,
      Object.getOwnPropertyDescriptor(OrdersController.prototype, method)
        ?.value as object,
    ) as Role[];

  it("POST /orders no admite CLIENT", () => {
    expect(rolesOf("createOrder")).toEqual([Role.SUPER_ADMIN, Role.OPS_ADMIN]);
  });

  it("POST /orders/:id/repeat no admite CLIENT", () => {
    expect(rolesOf("repeatOrder")).toEqual([Role.SUPER_ADMIN, Role.OPS_ADMIN]);
  });
});
