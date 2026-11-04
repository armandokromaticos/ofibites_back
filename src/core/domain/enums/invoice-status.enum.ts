/** Estado guardado de la factura (T-06). */
export enum InvoiceStatus {
  /** Emitida, con saldo. */
  PENDING = "PENDING",
  /** `amountPaid >= total`. */
  PAID = "PAID",
  /** Anulada (pedido cancelado sin pagos aprobados). */
  VOID = "VOID",
}
