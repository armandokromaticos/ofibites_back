/**
 * Regla de negocio de facturas/pagos violada dentro de una transacción
 * (T-06). La capa de aplicación traduce `code` a la respuesta HTTP con su
 * mensaje en español (`invoice-errors.ts`).
 */
export type InvoiceRuleCode =
  | "INVOICE_NOT_PAYABLE"
  | "PAYMENT_ALREADY_PENDING"
  | "PAYMENT_NOT_PENDING"
  | "PAYMENT_AMOUNT_EXCEEDS_BALANCE"
  | "ORDER_HAS_APPROVED_PAYMENTS"
  | "ORDER_STATUS_CHANGED";

export class InvoiceRuleException extends Error {
  constructor(
    readonly code: InvoiceRuleCode,
    readonly details: Record<string, unknown> = {},
  ) {
    super(`Regla de factura violada: ${code}`);
    this.name = "InvoiceRuleException";
  }
}
