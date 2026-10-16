import { Logger } from "@nestjs/common";
import {
  computeOrderSummary,
  DEFAULT_SHIPPING_FLAT_FEE,
  OrderSummary,
  parseShippingFlatFee,
} from "../../domain/services/order-summary";

const logger = new Logger("OrderSummaryConfig");
/** Último valor inválido avisado: un aviso por valor, no uno por cada carrito. */
let lastWarnedValue: string | null = null;

function warnInvalidFee(raw: string): void {
  if (raw === lastWarnedValue) return;
  lastWarnedValue = raw;
  logger.warn(
    `SHIPPING_FLAT_FEE="${raw}" no es un número válido mayor o igual a 0; se usa ${DEFAULT_SHIPPING_FLAT_FEE}`,
  );
}

/** Tarifa de envío vigente (`SHIPPING_FLAT_FEE`, por defecto 5). */
export function shippingFlatFee(): number {
  return parseShippingFlatFee(process.env.SHIPPING_FLAT_FEE, warnInvalidFee);
}

/**
 * Resumen (subtotal, IVA, envío, total) con la configuración del entorno. Lo
 * comparten la vista del carrito y el checkout para que el total confirmado
 * sea exactamente el que el usuario vio.
 */
export function buildOrderSummary(
  lineSubtotals: number[],
  discount = 0,
): OrderSummary {
  return computeOrderSummary({
    lineSubtotals,
    discount,
    shippingFlatFee: shippingFlatFee(),
  });
}
