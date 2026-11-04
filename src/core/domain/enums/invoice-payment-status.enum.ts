/**
 * Estado de pago **derivado** de la factura, para los chips del front
 * (`derivePaymentStatus` en `invoice-rules.ts`). No es columna de BD.
 */
export enum InvoicePaymentStatus {
  PAID = "PAID",
  VOID = "VOID",
  IN_REVIEW = "IN_REVIEW",
  OVERDUE = "OVERDUE",
  REJECTED = "REJECTED",
  PENDING = "PENDING",
}
