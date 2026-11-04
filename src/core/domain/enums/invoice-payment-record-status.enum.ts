/**
 * Estado de cada registro de pago (comprobante) de una factura. No confundir
 * con `InvoicePaymentStatus`, el estado de pago derivado de la factura.
 */
export enum InvoicePaymentRecordStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  /** El cliente canceló el envío, lo sustituyó por otro o la factura se anuló. */
  WITHDRAWN = "WITHDRAWN",
}
