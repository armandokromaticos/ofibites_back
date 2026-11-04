export enum NotificationType {
  ORDER_STATUS = "ORDER_STATUS",
  /** T-06: factura emitida al confirmar el pedido (a los pagadores). */
  INVOICE_GENERATED = "INVOICE_GENERATED",
  /** T-06: comprobante aprobado o rechazado (a quien lo subió). */
  PAYMENT_STATUS_CHANGED = "PAYMENT_STATUS_CHANGED",
}
