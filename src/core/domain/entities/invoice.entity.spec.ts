import { invoice, paymentRow } from "../../testing/invoice-fixtures";
import { InvoiceStatus } from "../enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../enums/invoice-payment-record-status.enum";
import { InvoicePaymentStatus } from "../enums/invoice-payment-status.enum";

const NOW = new Date("2026-10-16T14:00:00.000Z");

describe("InvoiceEntity", () => {
  it("resumen para el pedido: saldo, vencimiento, crédito y último pago", () => {
    const dto = invoice({
      total: 420.38,
      amountPaid: 200,
      dueDate: new Date("2026-10-19T00:00:00.000Z"),
      payments: [paymentRow({ amount: 220.38 })],
    }).toSummaryDto(NOW);

    expect(dto).toMatchObject({
      invoiceNumber: "F-2026-0001",
      status: InvoiceStatus.PENDING,
      paymentStatus: InvoicePaymentStatus.IN_REVIEW,
      dueDate: "2026-10-19T00:00:00.000Z",
      creditDays: 30,
      isCredit: true,
      isOverdue: false,
      daysUntilDue: 3,
      total: 420.38,
      amountPaid: 200,
      balance: 220.38,
      hasFiscalPdf: false,
      fiscalNumber: null,
      latestPayment: {
        id: "pay-1",
        status: InvoicePaymentRecordStatus.PENDING_REVIEW,
        amount: 220.38,
        submittedBy: { id: "user-1", name: "María Pérez" },
        proof: {
          fileName: "comprobante.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1000,
        },
      },
    });
  });

  it("vencida con el último comprobante rechazado → OVERDUE (isOverdue aparte)", () => {
    const entity = invoice({
      dueDate: new Date("2026-10-10T00:00:00.000Z"),
      payments: [paymentRow({ status: InvoicePaymentRecordStatus.REJECTED })],
    });
    expect(entity.paymentStatus(NOW)).toBe(InvoicePaymentStatus.OVERDUE);
    expect(entity.toSummaryDto(NOW)).toMatchObject({
      isOverdue: true,
      daysUntilDue: -6,
    });
  });

  it("pagada: daysUntilDue null y fiscalNumber/hasFiscalPdf si hay PDF fiscal", () => {
    const dto = invoice({
      status: InvoiceStatus.PAID,
      amountPaid: 116,
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
      fiscalPdfPath: "company-1/inv-1/fiscal.pdf",
      fiscalNumber: "00012345",
    }).toSummaryDto(NOW);
    expect(dto).toMatchObject({
      paymentStatus: InvoicePaymentStatus.PAID,
      isOverdue: false,
      daysUntilDue: null,
      balance: 0,
      hasFiscalPdf: true,
      fiscalNumber: "00012345",
    });
  });

  it("toResponseDto trae pedido, empresa, datos fiscales y todos los pagos", () => {
    const dto = invoice({
      payments: [
        paymentRow({ id: "pay-2" }),
        paymentRow({
          id: "pay-1",
          status: InvoicePaymentRecordStatus.REJECTED,
        }),
      ],
    }).toResponseDto(NOW);
    expect(dto).toMatchObject({
      orderId: "order-1",
      orderNumber: "OF-2026-0001",
      companyId: "company-1",
      companyName: "Andina, C.A.",
      billing: {
        name: "Andina, C.A.",
        taxId: "J-00000000-0",
        address: "Caracas",
      },
    });
    expect(dto.payments.map((p) => p.id)).toEqual(["pay-2", "pay-1"]);
  });
});
