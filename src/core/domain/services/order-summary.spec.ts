import {
  computeOrderSummary,
  DEFAULT_SHIPPING_FLAT_FEE,
  parseShippingFlatFee,
} from "./order-summary";

const FEE = 5;

describe("computeOrderSummary", () => {
  it("149,99 → paga envío (5) e IVA redondeado al céntimo", () => {
    const s = computeOrderSummary({
      lineSubtotals: [149.99],
      shippingFlatFee: FEE,
    });
    expect(s).toEqual({
      subtotal: 149.99,
      discount: 0,
      taxRate: 0.16,
      tax: 24, // 23,9984 → 24,00
      shipping: 5,
      freeShippingThreshold: 150,
      total: 178.99,
    });
  });

  it("150 exacto → envío gratis", () => {
    const s = computeOrderSummary({
      lineSubtotals: [100, 50],
      shippingFlatFee: FEE,
    });
    expect(s.shipping).toBe(0);
    expect(s.tax).toBe(24);
    expect(s.total).toBe(174);
  });

  it("suma en céntimos: 0,1 + 0,2 no arrastra error de coma flotante", () => {
    const s = computeOrderSummary({
      lineSubtotals: [0.1, 0.2],
      shippingFlatFee: FEE,
    });
    expect(s.subtotal).toBe(0.3);
    expect(s.tax).toBe(0.05); // 0,048 → 0,05
    expect(s.total).toBe(5.35);
  });

  it("redondea el IVA al céntimo más cercano", () => {
    // 10,03 × 0,16 = 1,6048 → 1,60 ; 10,05 × 0,16 = 1,608 → 1,61.
    // (Con el 16 % no hay mitades exactas: 16 × céntimos nunca acaba en 50.)
    expect(
      computeOrderSummary({ lineSubtotals: [10.03], shippingFlatFee: 0 }).tax,
    ).toBe(1.6);
    expect(
      computeOrderSummary({ lineSubtotals: [10.05], shippingFlatFee: 0 }).tax,
    ).toBe(1.61);
    // 0,03 × 0,16 = 0,0048 → 0,00
    expect(
      computeOrderSummary({ lineSubtotals: [0.03], shippingFlatFee: 0 }).tax,
    ).toBe(0);
  });

  it("el descuento reduce la base del IVA y del umbral de envío", () => {
    const s = computeOrderSummary({
      lineSubtotals: [160],
      discount: 20,
      shippingFlatFee: FEE,
    });
    expect(s.discount).toBe(20);
    expect(s.tax).toBe(22.4);
    expect(s.shipping).toBe(5); // base 140 < 150
    expect(s.total).toBe(167.4);
  });

  it("carrito vacío → todo en 0, sin envío", () => {
    expect(
      computeOrderSummary({ lineSubtotals: [], shippingFlatFee: FEE }),
    ).toMatchObject({ subtotal: 0, tax: 0, shipping: 0, total: 0 });
  });
});

describe("parseShippingFlatFee", () => {
  it.each([
    [undefined, DEFAULT_SHIPPING_FLAT_FEE],
    ["", DEFAULT_SHIPPING_FLAT_FEE],
    ["abc", DEFAULT_SHIPPING_FLAT_FEE],
    ["-1", DEFAULT_SHIPPING_FLAT_FEE],
    ["0", 0],
    ["7.5", 7.5],
    [" 3.456 ", 3.46],
  ])("%p → %p", (raw, expected) => {
    expect(parseShippingFlatFee(raw)).toBe(expected);
  });

  it("avisa (onInvalid) solo si está definida y no vale", () => {
    const onInvalid = jest.fn();
    parseShippingFlatFee("abc", onInvalid);
    parseShippingFlatFee("-2", onInvalid);
    parseShippingFlatFee(undefined, onInvalid);
    parseShippingFlatFee("  ", onInvalid);
    parseShippingFlatFee("4", onInvalid);
    expect(onInvalid.mock.calls).toEqual([["abc"], ["-2"]]);
  });

  it("el valor por defecto es 5", () => {
    expect(DEFAULT_SHIPPING_FLAT_FEE).toBe(5);
  });
});
