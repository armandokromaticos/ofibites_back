import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { CartController } from "./cart.controller";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformOrCompanyRoleGuard } from "../../auth/guards/platform-or-company-role.guard";
import { GetCartUseCase } from "../../../core/application/use-cases/cart/get-cart.use-case";
import { AddCartItemUseCase } from "../../../core/application/use-cases/cart/add-cart-item.use-case";
import { UpdateCartItemUseCase } from "../../../core/application/use-cases/cart/update-cart-item.use-case";
import { RemoveCartItemUseCase } from "../../../core/application/use-cases/cart/remove-cart-item.use-case";
import { ClearCartUseCase } from "../../../core/application/use-cases/cart/clear-cart.use-case";
import { RepeatOrderIntoCartUseCase } from "../../../core/application/use-cases/cart/repeat-order-into-cart.use-case";

const COMPANY_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

// Rutas, pipes y validación reales; guards y use-cases sustituidos.
describe("CartController (HTTP)", () => {
  let app: INestApplication<App>;
  const getCart = { execute: jest.fn(() => Promise.resolve({ items: [] })) };
  const repeat = {
    execute: jest.fn(() =>
      Promise.resolve({ cart: { items: [] }, added: 1, skipped: [] }),
    ),
  };
  const passGuard = {
    canActivate: (ctx: {
      switchToHttp: () => { getRequest: () => Record<string, unknown> };
    }) => {
      ctx.switchToHttp().getRequest().user = { id: "user-1", role: "CLIENT" };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: GetCartUseCase, useValue: getCart },
        { provide: AddCartItemUseCase, useValue: {} },
        { provide: UpdateCartItemUseCase, useValue: {} },
        { provide: RemoveCartItemUseCase, useValue: {} },
        { provide: ClearCartUseCase, useValue: {} },
        { provide: RepeatOrderIntoCartUseCase, useValue: repeat },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passGuard)
      .overrideGuard(PlatformOrCompanyRoleGuard)
      .useValue(passGuard)
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

  beforeEach(() => jest.clearAllMocks());

  it("POST /cart/repeat/last no pasa por el pipe de UUID", async () => {
    await request(app.getHttpServer())
      .post("/cart/repeat/last")
      .set("X-Company-Id", COMPANY_ID)
      .expect(200);
    expect(repeat.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      { id: "user-1", role: "CLIENT" },
      { last: true },
      undefined,
    );
  });

  it("POST /cart/repeat/:orderId con un id no UUID → 400 en español", async () => {
    const res = await request(app.getHttpServer())
      .post("/cart/repeat/no-es-uuid")
      .set("X-Company-Id", COMPANY_ID)
      .expect(400);
    expect((res.body as { message: unknown }).message).toBe(
      "orderId debe ser un UUID válido",
    );
    expect(repeat.execute).not.toHaveBeenCalled();
  });

  it("POST /cart/repeat/:orderId pasa el id y el idioma", async () => {
    await request(app.getHttpServer())
      .post(`/cart/repeat/${COMPANY_ID}?lang=en`)
      .set("X-Company-Id", COMPANY_ID)
      .expect(200);
    expect(repeat.execute).toHaveBeenCalledWith(
      COMPANY_ID,
      { id: "user-1", role: "CLIENT" },
      { orderId: COMPANY_ID },
      "en",
    );
  });

  it("GET /cart?lang=fr → 400", async () => {
    const res = await request(app.getHttpServer())
      .get("/cart?lang=fr")
      .set("X-Company-Id", COMPANY_ID)
      .expect(400);
    expect((res.body as { message: unknown }).message).toEqual([
      "lang solo admite: es, en",
    ]);
    expect(getCart.execute).not.toHaveBeenCalled();
  });

  it("GET /cart?lang=en pasa el idioma al use-case", async () => {
    await request(app.getHttpServer())
      .get("/cart?lang=en")
      .set("X-Company-Id", COMPANY_ID)
      .expect(200);
    expect(getCart.execute).toHaveBeenCalledWith(COMPANY_ID, "en");
  });
});
