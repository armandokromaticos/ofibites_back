import {
  applyApprovedPayment,
  computeCreditLine,
  computeInvoiceAlert,
  computeInvoiceDueDate,
  daysUntilDue,
  derivePaymentStatus,
  exceedsCreditLine,
  formatInvoiceNumber,
  invoiceBalance,
  OpenInvoiceSnapshot,
} from "./invoice-rules";
import { InvoiceStatus } from "../enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../enums/invoice-payment-record-status.enum";
import { InvoicePaymentStatus } from "../enums/invoice-payment-status.enum";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);

function open(
  overrides: Partial<OpenInvoiceSnapshot> = {},
): OpenInvoiceSnapshot {
  return {
    id: "inv-1",
    orderId: "order-1",
    invoiceNumber: "F-2026-0001",
    orderNumber: "OF-2026-0001",
    total: 100,
    amountPaid: 0,
    dueDate: d("2026-11-10"),
    hasPendingReview: false,
    latestPaymentStatus: null,
    ...overrides,
  };
}

describe("formatInvoiceNumber", () => {
  it("F-AAAA-NNNN y crece pasado 9999", () => {
    expect(formatInvoiceNumber(2026, 7)).toBe("F-2026-0007");
    expect(formatInvoiceNumber(2026, 10000)).toBe("F-2026-10000");
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
  });
});

describe("computeInvoiceDueDate (hora de Caracas)", () => {
  // 2026-10-16 22:30 en Caracas = 2026-10-17 02:30 UTC.
  const issuedAt = new Date("2026-10-17T02:30:00.000Z");

  it("contado con deliveryDate → vence el día de entrega", () => {
    expect(
      computeInvoiceDueDate({
        creditDays: 0,
        deliveryDate: d("2026-10-20"),
        issuedAt,
      }).toISOString(),
    ).toBe("2026-10-20T00:00:00.000Z");
  });

  it("contado sin deliveryDate → vence el día de emisión en Caracas (no el UTC)", () => {
    expect(
      computeInvoiceDueDate({
        creditDays: 0,
        deliveryDate: null,
        issuedAt,
      }).toISOString(),
    ).toBe("2026-10-16T00:00:00.000Z");
  });

  it("crédito → día de emisión en Caracas + creditDays (ignora la entrega)", () => {
    expect(
      computeInvoiceDueDate({
        creditDays: 30,
        deliveryDate: d("2026-10-20"),
        issuedAt,
      }).toISOString(),
    ).toBe("2026-11-15T00:00:00.000Z");
  });
});

describe("daysUntilDue", () => {
  it("cuenta días contra hoy en Caracas", () => {
    // 2026-10-16 23:59 en Caracas: sigue siendo el 16.
    const now = new Date("2026-10-17T03:59:00.000Z");
    expect(daysUntilDue(d("2026-10-16"), now)).toBe(0);
    expect(daysUntilDue(d("2026-10-19"), now)).toBe(3);
    expect(daysUntilDue(d("2026-10-15"), now)).toBe(-1);
  });
});

describe("derivePaymentStatus (precedencia)", () => {
  const now = new Date("2026-10-16T14:00:00.000Z");
  const base = {
    status: InvoiceStatus.PENDING,
    dueDate: d("2026-10-30"),
    latestPaymentStatus: null,
    hasPendingReview: false,
  };

  it("PAID y VOID mandan sobre todo", () => {
    expect(
      derivePaymentStatus(
        { ...base, status: InvoiceStatus.PAID, dueDate: d("2026-01-01") },
        now,
      ),
    ).toBe(InvoicePaymentStatus.PAID);
    expect(
      derivePaymentStatus(
        { ...base, status: InvoiceStatus.VOID, hasPendingReview: true },
        now,
      ),
    ).toBe(InvoicePaymentStatus.VOID);
  });

  it("IN_REVIEW antes que OVERDUE; OVERDUE antes que REJECTED", () => {
    const overdue = { ...base, dueDate: d("2026-10-15") };
    expect(
      derivePaymentStatus({ ...overdue, hasPendingReview: true }, now),
    ).toBe(InvoicePaymentStatus.IN_REVIEW);
    expect(
      derivePaymentStatus(
        {
          ...overdue,
          latestPaymentStatus: InvoicePaymentRecordStatus.REJECTED,
        },
        now,
      ),
    ).toBe(InvoicePaymentStatus.OVERDUE);
  });

  it("REJECTED si el último pago fue rechazado; PENDING en el resto", () => {
    expect(
      derivePaymentStatus(
        { ...base, latestPaymentStatus: InvoicePaymentRecordStatus.REJECTED },
        now,
      ),
    ).toBe(InvoicePaymentStatus.REJECTED);
    expect(
      derivePaymentStatus(
        { ...base, latestPaymentStatus: InvoicePaymentRecordStatus.WITHDRAWN },
        now,
      ),
    ).toBe(InvoicePaymentStatus.PENDING);
    expect(
      derivePaymentStatus({ ...base, dueDate: d("2026-10-16") }, now),
    ).toBe(InvoicePaymentStatus.PENDING);
  });
});

describe("pagos parciales", () => {
  it("acumula hasta cubrir el total y entonces queda saldada", () => {
    const first = applyApprovedPayment(420.38, 0, 200);
    expect(first).toEqual({ amountPaid: 200, isPaid: false });
    expect(invoiceBalance(420.38, first.amountPaid)).toBe(220.38);
    const second = applyApprovedPayment(420.38, first.amountPaid, 220.38);
    expect(second).toEqual({ amountPaid: 420.38, isPaid: true });
    expect(invoiceBalance(420.38, second.amountPaid)).toBe(0);
  });

  it("suma en céntimos (sin errores de coma flotante)", () => {
    expect(applyApprovedPayment(0.3, 0.1, 0.2)).toEqual({
      amountPaid: 0.3,
      isPaid: true,
    });
  });
});

describe("computeInvoiceAlert", () => {
  // 2026-10-16 22:00 en Caracas (ya 17 en UTC).
  const now = new Date("2026-10-17T02:00:00.000Z");

  it("DUE_SOON si vence en 0–3 días (Caracas), la más próxima; no bloquea", () => {
    const alert = computeInvoiceAlert(
      [
        open({ id: "a", dueDate: d("2026-10-19") }),
        open({ id: "b", dueDate: d("2026-10-16") }),
        open({ id: "c", dueDate: d("2026-10-20") }),
      ],
      now,
    );
    expect(alert).toMatchObject({
      level: "DUE_SOON",
      blocksCheckout: false,
      count: 2,
      invoice: { id: "b", daysUntilDue: 0 },
    });
  });

  it("a 4 días todavía no avisa", () => {
    expect(computeInvoiceAlert([open({ dueDate: d("2026-10-20") })], now)).toBe(
      null,
    );
  });

  it("OVERDUE manda: la vencida más antigua, con saldo y estado", () => {
    const alert = computeInvoiceAlert(
      [
        open({ id: "soon", dueDate: d("2026-10-17") }),
        open({
          id: "old",
          dueDate: d("2026-10-01"),
          total: 340,
          amountPaid: 40,
        }),
        open({ id: "new", dueDate: d("2026-10-15"), hasPendingReview: true }),
      ],
      now,
    );
    expect(alert).toMatchObject({
      level: "OVERDUE",
      blocksCheckout: true,
      count: 2,
      invoice: {
        id: "old",
        balance: 300,
        paymentStatus: InvoicePaymentStatus.OVERDUE,
      },
    });
  });
});

describe("computeCreditLine", () => {
  const now = new Date("2026-10-16T14:00:00.000Z");

  it("contado → null", () => {
    expect(
      computeCreditLine({ creditDays: 0, creditLimit: 500 }, [], now),
    ).toBe(null);
  });

  it("comprometido = saldos abiertos; disponible = cupo − comprometido (mín. 0)", () => {
    const line = computeCreditLine(
      { creditDays: 30, creditLimit: 8000 },
      [open({ total: 3000, amountPaid: 500 }), open({ total: 1480.2 })],
      now,
    );
    expect(line).toEqual({
      creditDays: 30,
      creditLimit: 8000,
      committed: 3980.2,
      available: 4019.8,
      isBlocked: false,
    });
    expect(
      computeCreditLine(
        { creditDays: 30, creditLimit: 100 },
        [open({ total: 300 })],
        now,
      )?.available,
    ).toBe(0);
  });

  it("sin tope: available null y nunca se excede; vencida → isBlocked", () => {
    const line = computeCreditLine(
      { creditDays: 15, creditLimit: null },
      [open({ dueDate: d("2026-10-01") })],
      now,
    );
    expect(line?.available).toBeNull();
    expect(line?.isBlocked).toBe(true);
    expect(exceedsCreditLine(line, 1_000_000)).toBe(false);
  });

  it("exceedsCreditLine compara en céntimos", () => {
    const line = computeCreditLine(
      { creditDays: 30, creditLimit: 100 },
      [],
      now,
    );
    expect(exceedsCreditLine(line, 100)).toBe(false);
    expect(exceedsCreditLine(line, 100.01)).toBe(true);
  });
});
