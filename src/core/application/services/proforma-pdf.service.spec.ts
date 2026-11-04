import { ProformaPdfService, proformaStamp } from "./proforma-pdf.service";
import { invoice, paymentRow } from "../../testing/invoice-fixtures";
import { InvoiceStatus } from "../../domain/enums/invoice-status.enum";
import { InvoicePaymentRecordStatus } from "../../domain/enums/invoice-payment-record-status.enum";

const NOW = new Date("2026-10-16T14:00:00.000Z");
const d = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe("ProformaPdfService", () => {
  it("genera un PDF (pdfkit) con líneas y pagos aprobados", async () => {
    const buffer = await new ProformaPdfService().render(
      invoice({
        status: InvoiceStatus.PAID,
        amountPaid: 116,
        paidAt: NOW,
        payments: [
          paymentRow({
            status: InvoicePaymentRecordStatus.APPROVED,
            amount: 116,
          }),
        ],
      }),
      {
        orderNumber: "OF-2026-0001",
        deliveryDate: d("2026-10-20"),
        requesterName: "María Pérez",
        lines: [
          {
            description: "Coffee Break Clásico · 10 personas",
            quantity: 2,
            unitPrice: 50,
            total: 100,
          },
        ],
      },
      NOW,
      { legalName: "Ofibites", taxId: "", address: "", billingEmail: "" },
    );
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("muchas líneas: salta de página (más de un objeto /Page)", async () => {
    const lines = Array.from({ length: 80 }, (_, i) => ({
      description: `Producto ${i + 1} con un nombre bastante largo para ocupar espacio`,
      quantity: 1,
      unitPrice: 1,
      total: 1,
    }));
    const buffer = await new ProformaPdfService().render(
      invoice({ status: InvoiceStatus.VOID }),
      {
        orderNumber: "OF-2026-0001",
        deliveryDate: null,
        requesterName: null,
        lines,
      },
      NOW,
      { legalName: "Ofibites", taxId: "", address: "", billingEmail: "" },
    );
    const pages = buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });

  it("sello según el estado y el vencimiento (hora de Caracas)", () => {
    expect(proformaStamp(invoice({ status: InvoiceStatus.VOID }), NOW)).toBe(
      "ANULADA",
    );
    expect(proformaStamp(invoice({ status: InvoiceStatus.PAID }), NOW)).toBe(
      "PAGADA",
    );
    expect(proformaStamp(invoice({ dueDate: d("2026-10-15") }), NOW)).toBe(
      "VENCIDA",
    );
    expect(proformaStamp(invoice({ dueDate: d("2026-10-19") }), NOW)).toBe(
      "POR VENCER",
    );
    expect(proformaStamp(invoice({ dueDate: d("2026-11-30") }), NOW)).toBe(
      "POR PAGAR",
    );
  });
});
