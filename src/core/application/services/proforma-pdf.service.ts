import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { InvoiceEntity } from "../../domain/entities/invoice.entity";
import { InvoiceStatus } from "../../domain/enums/invoice-status.enum";
import { PAYMENT_METHOD_LABELS } from "../../domain/enums/payment-method.enum";
import { InvoiceDocumentData } from "../../domain/repositories/invoice.repository.interface";
import {
  daysUntilDue,
  INVOICE_DUE_SOON_DAYS,
} from "../../domain/services/invoice-rules";
import { formatUsd } from "../shared/invoice-errors";
import { toCaracasDateKey } from "../shared/caracas-time.util";

/** Datos del emisor (Ofibites) por variables de entorno; vacíos si faltan. */
export interface IssuerData {
  legalName: string;
  taxId: string;
  address: string;
  billingEmail: string;
}

export function issuerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): IssuerData {
  return {
    legalName: env.OFIBITES_LEGAL_NAME?.trim() || "Ofibites",
    taxId: env.OFIBITES_TAX_ID?.trim() ?? "",
    address: env.OFIBITES_ADDRESS?.trim() ?? "",
    billingEmail: env.OFIBITES_BILLING_EMAIL?.trim() ?? "",
  };
}

/** "26/09/2026" de una fecha pura (`@db.Date`, componentes UTC). */
function pureDate(date: Date): string {
  const [y, m, d] = date.toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "26/09/2026" de un instante, en hora de Caracas. */
function caracasDate(date: Date): string {
  const [y, m, d] = toCaracasDateKey(date).split("-");
  return `${d}/${m}/${y}`;
}

/** Sello de estado de la proforma; cambia con el tiempo (por eso no se guarda). */
export function proformaStamp(invoice: InvoiceEntity, now: Date): string {
  if (invoice.status === InvoiceStatus.VOID) return "ANULADA";
  if (invoice.status === InvoiceStatus.PAID) return "PAGADA";
  const days = daysUntilDue(invoice.dueDate, now);
  if (days < 0) return "VENCIDA";
  if (days <= INVOICE_DUE_SOON_DAYS) return "POR VENCER";
  return "POR PAGAR";
}

/**
 * Proforma no fiscal (T-06) generada al vuelo con pdfkit: todo lo que imprime
 * es una foto inmutable de la factura y del pedido, salvo el sello de estado.
 */
@Injectable()
export class ProformaPdfService {
  async render(
    invoice: InvoiceEntity,
    data: InvoiceDocumentData,
    now: Date = new Date(),
    issuer: IssuerData = issuerFromEnv(),
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const left = 50;
    const right = doc.page.width - 50;
    const width = right - left;

    doc.font("Helvetica-Bold").fontSize(18).text("PROFORMA", left, 50);
    doc.fontSize(14).text(invoice.invoiceNumber);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Emitida el ${caracasDate(invoice.issuedAt)}`)
      .text(`Vence el ${pureDate(invoice.dueDate)}`);
    if (invoice.fiscalNumber) {
      doc.text(`Factura fiscal ${invoice.fiscalNumber}`);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(proformaStamp(invoice, now), left, 50, { width, align: "right" });

    doc.moveDown(4);
    const blockTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).text("EMISOR", left, blockTop);
    doc.font("Helvetica").fontSize(10).text(issuer.legalName);
    if (issuer.taxId) doc.text(`RIF ${issuer.taxId}`);
    if (issuer.address) doc.text(issuer.address, { width: width / 2 - 10 });
    if (issuer.billingEmail) doc.text(issuer.billingEmail);
    const emitterBottom = doc.y;

    const half = left + width / 2;
    doc.font("Helvetica-Bold").fontSize(9).text("CLIENTE", half, blockTop);
    doc.font("Helvetica").fontSize(10).text(invoice.billingName, half);
    doc.text(`RIF ${invoice.billingTaxId}`, half);
    if (invoice.billingAddress) {
      doc.text(invoice.billingAddress, half, undefined, { width: width / 2 });
    }
    if (data.requesterName) doc.text(`Att: ${data.requesterName}`, half);
    doc.y = Math.max(doc.y, emitterBottom);

    doc.moveDown(1.5);
    doc
      .fontSize(10)
      .text(
        `Pedido #${data.orderNumber ?? invoice.orderId.slice(-8).toUpperCase()}`,
        left,
      )
      .text(
        `Condiciones de pago: ${
          invoice.creditDays > 0
            ? `Crédito corporativo a ${invoice.creditDays} días`
            : "Contado"
        }`,
      );

    doc.moveDown();
    const cols = [
      left,
      left + width * 0.6,
      left + width * 0.72,
      left + width * 0.86,
    ];
    const bottom = doc.page.height - doc.page.margins.bottom;
    const descWidth = cols[1] - cols[0] - 8;
    // Cabecera de la tabla; se repinta en cada página nueva.
    const paintHeader = () => {
      const top = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("DESCRIPCIÓN", cols[0], top, { lineBreak: false });
      doc.text("CANT.", cols[1], top, { lineBreak: false });
      doc.text("P. UNIT.", cols[2], top, { lineBreak: false });
      doc.text("TOTAL", cols[3], top, {
        width: right - cols[3],
        align: "right",
        lineBreak: false,
      });
      doc.font("Helvetica").fontSize(10);
      doc.y = top + 16;
    };
    const newPage = () => {
      doc.addPage();
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#666666")
        .text(
          `${invoice.invoiceNumber} (continuación)`,
          left,
          doc.page.margins.top,
        )
        .fillColor("#000000");
      doc.moveDown();
    };
    paintHeader();
    for (const line of data.lines) {
      doc.font("Helvetica").fontSize(10);
      const rowHeight = doc.heightOfString(line.description, {
        width: descWidth,
      });
      // La fila entera en la misma página: si no cabe, página nueva + cabecera.
      if (doc.y + rowHeight > bottom) {
        newPage();
        paintHeader();
      }
      const y = doc.y;
      doc.text(line.description, cols[0], y, { width: descWidth });
      doc.text(String(line.quantity), cols[1], y, { lineBreak: false });
      doc.text(formatUsd(line.unitPrice), cols[2], y, { lineBreak: false });
      doc.text(formatUsd(line.total), cols[3], y, {
        width: right - cols[3],
        align: "right",
        lineBreak: false,
      });
      doc.y = y + rowHeight + 4;
    }

    const totals: [string, number][] = [["Subtotal", invoice.subtotal]];
    if (invoice.discount > 0) totals.push(["Descuento", -invoice.discount]);
    totals.push(["IVA (16%)", invoice.tax], ["Envío", invoice.shipping]);
    // Bloque de totales completo en la misma página.
    if (doc.y + 14 + totals.length * 14 + 24 > bottom) newPage();
    doc.y += 14;
    for (const [label, amount] of totals) {
      const y = doc.y;
      doc.text(label, cols[2], y, { lineBreak: false });
      doc.text(
        amount < 0 ? `- ${formatUsd(-amount)}` : formatUsd(amount),
        cols[3],
        y,
        { width: right - cols[3], align: "right", lineBreak: false },
      );
      doc.y = y + 14;
    }
    const totalY = doc.y + 4;
    const totalLabel =
      invoice.status === InvoiceStatus.PAID
        ? "Total pagado"
        : invoice.status === InvoiceStatus.VOID
          ? "Total"
          : "Total a pagar";
    const totalAmount =
      invoice.status === InvoiceStatus.PENDING
        ? invoice.balance
        : invoice.total;
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(totalLabel, cols[2] - 40, totalY, { lineBreak: false });
    doc.text(formatUsd(totalAmount), cols[3], totalY, {
      width: right - cols[3],
      align: "right",
      lineBreak: false,
    });
    doc.y = totalY + 18;

    const approved = invoice.approvedPayments;
    if (approved.length > 0) {
      doc.moveDown(1.5).font("Helvetica").fontSize(10).text("Pagos", left);
      for (const payment of approved) {
        doc.text(
          `${PAYMENT_METHOD_LABELS[payment.method]} · Ref. ${payment.reference} · ${formatUsd(payment.amount)} · pagado el ${pureDate(payment.paymentDate)}`,
          left,
        );
      }
      if (invoice.paidAt) {
        doc.text(`Pagada el ${caracasDate(invoice.paidAt)}`, left);
      }
    }

    doc
      .moveDown(3)
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text(
        "Documento no fiscal. La factura fiscal la emite Ofibites.",
        left,
        undefined,
        { width, align: "center" },
      );

    doc.end();
    return done;
  }
}
