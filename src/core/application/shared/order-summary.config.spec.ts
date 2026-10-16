import { Logger } from "@nestjs/common";
import { shippingFlatFee } from "./order-summary.config";

describe("shippingFlatFee", () => {
  const ORIGINAL = process.env.SHIPPING_FLAT_FEE;
  afterEach(() => {
    jest.restoreAllMocks();
    if (ORIGINAL === undefined) delete process.env.SHIPPING_FLAT_FEE;
    else process.env.SHIPPING_FLAT_FEE = ORIGINAL;
  });

  it("valor inválido → 5 y un Logger.warn (una vez por valor)", () => {
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    process.env.SHIPPING_FLAT_FEE = "cinco";

    expect(shippingFlatFee()).toBe(5);
    expect(shippingFlatFee()).toBe(5);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('SHIPPING_FLAT_FEE="cinco"');
  });

  it("sin variable o válida → sin aviso", () => {
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    delete process.env.SHIPPING_FLAT_FEE;
    expect(shippingFlatFee()).toBe(5);
    process.env.SHIPPING_FLAT_FEE = "7";
    expect(shippingFlatFee()).toBe(7);
    expect(warn).not.toHaveBeenCalled();
  });
});
