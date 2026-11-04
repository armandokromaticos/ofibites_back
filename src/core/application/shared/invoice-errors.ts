import {
  BadRequestException,
  ConflictException,
  HttpException,
} from "@nestjs/common";
import {
  InvoiceRuleCode,
  InvoiceRuleException,
} from "../../domain/exceptions/invoice-rule.exception";

/** "$ 1.250,02" (formato de los textos del Figma). */
export function formatUsd(amount: number): string {
  const [int, dec] = amount.toFixed(2).split(".");
  return `$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

export const INVOICE_NOT_FOUND_MESSAGE = "Factura no encontrada";
export const PAYMENT_NOT_FOUND_MESSAGE = "Pago no encontrado";

const MESSAGES: Record<
  InvoiceRuleCode,
  (details: Record<string, unknown>) => string
> = {
  INVOICE_NOT_PAYABLE: () => "Esta factura ya no admite pagos",
  PAYMENT_ALREADY_PENDING: () =>
    "Ya hay un comprobante en revisión para esta factura. Cancélalo si quieres enviar otro",
  PAYMENT_NOT_PENDING: () => "Este comprobante ya fue revisado o cancelado",
  PAYMENT_AMOUNT_EXCEEDS_BALANCE: (details) =>
    `El monto no puede ser mayor que el saldo de la factura (${formatUsd(Number(details.balance ?? 0))})`,
  ORDER_HAS_APPROVED_PAYMENTS: () =>
    "No se puede cancelar este pedido porque su factura tiene pagos aprobados. Escríbenos para resolverlo.",
  ORDER_STATUS_CHANGED: () =>
    "El pedido cambió de estado mientras lo actualizabas. Recárgalo e inténtalo de nuevo",
};

const BAD_REQUEST_CODES = new Set<InvoiceRuleCode>([
  "PAYMENT_AMOUNT_EXCEEDS_BALANCE",
  "ORDER_HAS_APPROVED_PAYMENTS",
]);

/**
 * `InvoiceRuleException` → 400/409 con el cuerpo `{ statusCode, error,
 * message, code }` (mismo formato que el checkout). Otro error se devuelve tal
 * cual para relanzarlo.
 */
export function toInvoiceHttpError(error: unknown): unknown {
  if (!(error instanceof InvoiceRuleException)) return error;
  const message = MESSAGES[error.code](error.details);
  if (BAD_REQUEST_CODES.has(error.code)) {
    return new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      message,
      code: error.code,
    });
  }
  return new ConflictException({
    statusCode: 409,
    error: "Conflict",
    message,
    code: error.code,
  });
}

/** Ejecuta `fn` traduciendo `InvoiceRuleException` a HTTP. */
export async function withInvoiceHttpErrors<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const mapped = toInvoiceHttpError(error);
    if (mapped instanceof HttpException) throw mapped;
    throw error;
  }
}
