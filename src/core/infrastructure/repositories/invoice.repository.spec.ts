import { Prisma } from "@prisma/client";
import {
  InvoiceRepository,
  issueInvoiceWithin,
  voidInvoiceForCancellationWithin,
} from "./invoice.repository";
import { OrderRepository } from "./order.repository";
import type { PrismaService } from "../database/prisma/prisma.service";
import { InvoiceRuleException } from "../../domain/exceptions/invoice-rule.exception";
import { InvoiceStatus } from "../../domain/enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../../domain/enums/invoice-payment-record-status.enum";
import { OrderStatus } from "../../domain/enums/order-status.enum";
import { InvoicePaymentStatus } from "../../domain/enums/invoice-payment-status.enum";
import { invoiceRow, paymentRow } from "../../testing/invoice-fixtures";

const dec = (n: number) => new Prisma.Decimal(n);

function orderRow(
  company: { creditDays: number; fiscalName?: string | null },
  deliveryDate: Date | null,
) {
  return {
    companyId: "company-1",
    deliveryDate,
    subtotal: dec(100),
    discount: dec(0),
    tax: dec(16),
    shipping: dec(5),
    total: dec(121),
    company: {
      creditDays: company.creditDays,
      legalName: "Andina",
      fiscalName: company.fiscalName ?? null,
      taxId: "J-1",
      fiscalAddress: "Caracas",
    },
  };
}

/** Cliente de transacción con lo justo para emitir / anular. */
function txClient(options: {
  existingInvoice?: boolean;
  order?: ReturnType<typeof orderRow>;
  lockedInvoiceId?: string | null;
  approvedCount?: number;
}) {
  return {
    $queryRaw: jest.fn((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join("?").includes("FOR UPDATE")
          ? options.lockedInvoiceId
            ? [{ id: options.lockedInvoiceId }]
            : []
          : [{ last_value: 1 }],
      ),
    ),
    invoice: {
      findUnique: jest.fn(() =>
        Promise.resolve(options.existingInvoice ? { id: "inv-0" } : null),
      ),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "inv-new", ...args.data }),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    order: {
      findUniqueOrThrow: jest.fn(() => Promise.resolve(options.order)),
    },
    invoicePayment: {
      count: jest.fn(() => Promise.resolve(options.approvedCount ?? 0)),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
  };
}

type Tx = Prisma.TransactionClient;

describe("issueInvoiceWithin (emisión al confirmar)", () => {
  // 2026-10-16 22:30 en Caracas.
  const NOW = new Date("2026-10-17T02:30:00.000Z");

  it("contado con entrega → vence el día de entrega; foto de importes y datos fiscales", async () => {
    const tx = txClient({
      order: orderRow({ creditDays: 0 }, new Date("2026-10-20T00:00:00.000Z")),
    });
    await expect(
      issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW),
    ).resolves.toBe("inv-new");
    const data = tx.invoice.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      invoiceNumber: "F-2026-0001",
      orderId: "order-1",
      companyId: "company-1",
      status: InvoiceStatus.PENDING,
      creditDays: 0,
      billingName: "Andina",
      billingTaxId: "J-1",
      billingAddress: "Caracas",
    });
    expect((data.dueDate as Date).toISOString()).toBe(
      "2026-10-20T00:00:00.000Z",
    );
    expect(String(data.total)).toBe("121");
  });

  it("contado sin entrega → vence el día de emisión en Caracas", async () => {
    const tx = txClient({ order: orderRow({ creditDays: 0 }, null) });
    await issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW);
    const due = tx.invoice.create.mock.calls[0][0].data.dueDate as Date;
    expect(due.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("crédito → emisión + creditDays; usa fiscalName si existe", async () => {
    const tx = txClient({
      order: orderRow(
        { creditDays: 30, fiscalName: "Andina, C.A." },
        new Date("2026-10-20T00:00:00.000Z"),
      ),
    });
    await issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW);
    const data = tx.invoice.create.mock.calls[0][0].data;
    expect((data.dueDate as Date).toISOString()).toBe(
      "2026-11-15T00:00:00.000Z",
    );
    expect(data.billingName).toBe("Andina, C.A.");
  });

  it("total 0 (100 % de descuento) → nace PAID con paidAt", async () => {
    const tx = txClient({
      order: { ...orderRow({ creditDays: 0 }, null), total: dec(0) },
    });
    await issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW);
    const data = tx.invoice.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: InvoiceStatus.PAID, paidAt: NOW });
  });

  it("total positivo → PENDING sin paidAt", async () => {
    const tx = txClient({ order: orderRow({ creditDays: 0 }, null) });
    await issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW);
    const data = tx.invoice.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: InvoiceStatus.PENDING, paidAt: null });
  });

  it("idempotente: si el pedido ya tiene factura no crea otra", async () => {
    const tx = txClient({ existingInvoice: true });
    await expect(
      issueInvoiceWithin(tx as unknown as Tx, "order-1", NOW),
    ).resolves.toBeNull();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});

describe("voidInvoiceForCancellationWithin", () => {
  it("con pagos aprobados lanza ORDER_HAS_APPROVED_PAYMENTS y no toca nada", async () => {
    const tx = txClient({ lockedInvoiceId: "inv-1", approvedCount: 1 });
    await expect(
      voidInvoiceForCancellationWithin(tx as unknown as Tx, "order-1"),
    ).rejects.toMatchObject({ code: "ORDER_HAS_APPROVED_PAYMENTS" });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(tx.invoicePayment.updateMany).not.toHaveBeenCalled();
  });

  it("sin pagos aprobados: retira el pendiente y anula la factura", async () => {
    const tx = txClient({ lockedInvoiceId: "inv-1" });
    await voidInvoiceForCancellationWithin(tx as unknown as Tx, "order-1");
    expect(tx.invoicePayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          invoiceId: "inv-1",
          status: InvoicePaymentRecordStatus.PENDING_REVIEW,
        },
        data: expect.objectContaining({
          status: InvoicePaymentRecordStatus.WITHDRAWN,
        }) as unknown,
      }),
    );
    expect(tx.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1", status: InvoiceStatus.PENDING },
        data: expect.objectContaining({
          status: InvoiceStatus.VOID,
        }) as unknown,
      }),
    );
  });

  it("pedido sin factura: no hace nada", async () => {
    const tx = txClient({ lockedInvoiceId: null });
    await voidInvoiceForCancellationWithin(tx as unknown as Tx, "order-1");
    expect(tx.invoicePayment.count).not.toHaveBeenCalled();
  });
});

describe("OrderRepository.updateStatus (T-06)", () => {
  function prismaWith(tx: Record<string, unknown>) {
    return {
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
  }

  function orderTx(options: {
    moved: number;
    approvedCount?: number;
    lockedInvoiceId?: string | null;
  }) {
    const base = txClient({
      lockedInvoiceId: options.lockedInvoiceId ?? "inv-1",
      approvedCount: options.approvedCount,
      order: orderRow({ creditDays: 15 }, null),
    });
    return {
      ...base,
      order: {
        ...base.order,
        updateMany: jest.fn(() => Promise.resolve({ count: options.moved })),
        findUniqueOrThrow: jest.fn((args: { include?: unknown }) =>
          Promise.resolve(
            args.include
              ? {
                  id: "order-1",
                  companyId: "company-1",
                  createdById: "user-1",
                  deliveryAddressId: "addr-1",
                  status: OrderStatus.CONFIRMED,
                  priority: "MEDIUM",
                  total: dec(121),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  items: [],
                  invoice: null,
                }
              : orderRow({ creditDays: 15 }, null),
          ),
        ),
      },
    };
  }

  it("si el pedido ya no está en el estado leído → ORDER_STATUS_CHANGED, sin emitir", async () => {
    const tx = orderTx({ moved: 0 });
    const repo = new OrderRepository(prismaWith(tx));
    await expect(
      repo.updateStatus(
        "order-1",
        OrderStatus.CONFIRMED,
        OrderStatus.PENDING_CONFIRMATION,
      ),
    ).rejects.toMatchObject({ code: "ORDER_STATUS_CHANGED" });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: OrderStatus.PENDING_CONFIRMATION },
      data: { status: OrderStatus.CONFIRMED },
    });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("a CONFIRMED emite la factura en la misma transacción", async () => {
    const tx = orderTx({ moved: 1 });
    const repo = new OrderRepository(prismaWith(tx));
    await repo.updateStatus(
      "order-1",
      OrderStatus.CONFIRMED,
      OrderStatus.PENDING_CONFIRMATION,
    );
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
  });

  it("a CANCELLED con pagos aprobados no mueve el pedido", async () => {
    const tx = orderTx({ moved: 1, approvedCount: 2 });
    const repo = new OrderRepository(prismaWith(tx));
    const error: unknown = await repo
      .updateStatus("order-1", OrderStatus.CANCELLED, OrderStatus.CONFIRMED)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvoiceRuleException);
    expect((error as InvoiceRuleException).code).toBe(
      "ORDER_HAS_APPROVED_PAYMENTS",
    );
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("otras transiciones no emiten ni anulan", async () => {
    const tx = orderTx({ moved: 1 });
    const repo = new OrderRepository(prismaWith(tx));
    await repo.updateStatus(
      "order-1",
      OrderStatus.IN_PREPARATION,
      OrderStatus.CONFIRMED,
    );
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.invoicePayment.count).not.toHaveBeenCalled();
  });
});

describe("InvoiceRepository.findMany (cola de Ofibites)", () => {
  const NOW = new Date("2026-10-17T02:00:00.000Z"); // 16/10 22:00 Caracas

  function setup(rows: ReturnType<typeof invoiceRow>[] = [invoiceRow()]) {
    const invoice = {
      findMany: jest.fn(() => Promise.resolve(rows)),
      count: jest.fn(() => Promise.resolve(42)),
    };
    const repo = new InvoiceRepository({ invoice } as unknown as PrismaService);
    return { repo, invoice };
  }

  it("sin estado derivado: pagina y cuenta en BD (vencidas por columna, hoy de Caracas)", async () => {
    const { repo, invoice } = setup();
    const result = await repo.findMany({
      companyId: "company-1",
      overdue: true,
      skip: 20,
      take: 10,
      now: NOW,
    });
    expect(result.total).toBe(42);
    const args = (
      invoice.findMany.mock.calls[0] as unknown as [
        { where: unknown; skip: number; take: number },
      ]
    )[0];
    expect(args).toMatchObject({ skip: 20, take: 10 });
    expect(args.where).toEqual({
      AND: [
        { companyId: "company-1" },
        {
          status: InvoiceStatus.PENDING,
          dueDate: { lt: new Date("2026-10-16T00:00:00.000Z") },
        },
      ],
    });
  });

  it("PAID / VOID también se resuelven en BD", async () => {
    const { repo, invoice } = setup();
    await repo.findMany({
      paymentStatus: InvoicePaymentStatus.PAID,
      skip: 0,
      take: 20,
      now: NOW,
    });
    expect(invoice.count).toHaveBeenCalledTimes(1);
  });

  it("derivado (IN_REVIEW): filtra en memoria sobre PENDING y pagina después", async () => {
    const { repo, invoice } = setup([
      invoiceRow({ id: "a" }),
      invoiceRow({ id: "b", payments: [paymentRow()] }),
    ]);
    const result = await repo.findMany({
      paymentStatus: InvoicePaymentStatus.IN_REVIEW,
      skip: 0,
      take: 20,
      now: NOW,
    });
    expect(invoice.count).not.toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.data.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("InvoiceRepository.approvePayment (pagos parciales)", () => {
  function setup(
    invoice: { total: number; amountPaid: number; status?: InvoiceStatus },
    amount: number,
  ) {
    const tx = {
      $queryRaw: jest.fn(() => Promise.resolve([{ id: "inv-1" }])),
      invoice: {
        findUniqueOrThrow: jest.fn(() =>
          Promise.resolve({
            status: invoice.status ?? InvoiceStatus.PENDING,
            total: dec(invoice.total),
            amountPaid: dec(invoice.amountPaid),
          }),
        ),
        update: jest.fn(() => Promise.resolve({})),
      },
      invoicePayment: {
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
        findUniqueOrThrow: jest.fn(() =>
          Promise.resolve(
            paymentRow({ amount, status: InvoicePaymentRecordStatus.APPROVED }),
          ),
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      invoice: { findUnique: jest.fn(() => Promise.resolve(invoiceRow())) },
    } as unknown as PrismaService;
    return { repo: new InvoiceRepository(prisma), tx };
  }
  const NOW = new Date("2026-10-16T14:00:00.000Z");

  it("un pago parcial suma a amountPaid y la factura sigue PENDING", async () => {
    const { repo, tx } = setup({ total: 420.38, amountPaid: 0 }, 200);
    await repo.approvePayment("inv-1", "pay-1", "admin-1", NOW);
    const data = (
      tx.invoice.update.mock.calls[0] as unknown as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    expect(String(data.amountPaid)).toBe("200");
    expect(data.status).toBeUndefined();
  });

  it("el pago que completa el total pasa la factura a PAID con paidAt", async () => {
    const { repo, tx } = setup({ total: 420.38, amountPaid: 200 }, 220.38);
    await repo.approvePayment("inv-1", "pay-1", "admin-1", NOW);
    const data = (
      tx.invoice.update.mock.calls[0] as unknown as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    expect(String(data.amountPaid)).toBe("420.38");
    expect(data).toMatchObject({ status: InvoiceStatus.PAID, paidAt: NOW });
  });

  it("un comprobante que ya no está en revisión → PAYMENT_NOT_PENDING", async () => {
    const { repo, tx } = setup({ total: 100, amountPaid: 0 }, 100);
    tx.invoicePayment.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repo.approvePayment("inv-1", "pay-1", "admin-1", NOW),
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_PENDING" });
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it("factura anulada → INVOICE_NOT_PAYABLE", async () => {
    const { repo } = setup(
      { total: 100, amountPaid: 0, status: InvoiceStatus.VOID },
      100,
    );
    await expect(
      repo.approvePayment("inv-1", "pay-1", "admin-1", NOW),
    ).rejects.toMatchObject({ code: "INVOICE_NOT_PAYABLE" });
  });
});
