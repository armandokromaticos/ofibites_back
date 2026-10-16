/**
 * Resumen de importes del carrito y del checkout (T-26a). Función pura: todo
 * se calcula en céntimos enteros para no arrastrar errores de coma flotante y
 * se devuelve en unidades con 2 decimales.
 *
 * - base = subtotal − descuento (nunca negativa)
 * - tax = base × 16 %, redondeado al céntimo (mitades hacia arriba)
 * - shipping = 0 si base ≥ 150 o el carrito está vacío; si no, la tarifa plana
 * - total = base + tax + shipping
 */

export const TAX_RATE = 0.16;
/** IVA en puntos básicos (16 % = 1600) para operar con enteros. */
const TAX_RATE_BASIS_POINTS = 1600;
export const FREE_SHIPPING_THRESHOLD = 150;
/** Tarifa de envío por debajo del umbral si `SHIPPING_FLAT_FEE` no está definida. */
export const DEFAULT_SHIPPING_FLAT_FEE = 5;

export interface OrderSummary {
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  shipping: number;
  freeShippingThreshold: number;
  total: number;
}

export interface OrderSummaryInput {
  /** Subtotales de cada línea (ya redondeados a 2 decimales por el pricing). */
  lineSubtotals: number[];
  /** Descuento en unidades; 0 en la fase 1 (sin cupón). */
  discount?: number;
  /** Tarifa de envío por debajo del umbral, en unidades. */
  shippingFlatFee: number;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

export function computeOrderSummary(input: OrderSummaryInput): OrderSummary {
  const subtotalCents = input.lineSubtotals.reduce(
    (sum, line) => sum + toCents(line),
    0,
  );
  const discountCents = Math.min(
    Math.max(toCents(input.discount ?? 0), 0),
    subtotalCents,
  );
  const baseCents = subtotalCents - discountCents;
  const taxCents = Math.round((baseCents * TAX_RATE_BASIS_POINTS) / 10_000);

  const isEmpty = input.lineSubtotals.length === 0;
  const freeShipping = isEmpty || baseCents >= toCents(FREE_SHIPPING_THRESHOLD);
  const shippingCents = freeShipping
    ? 0
    : Math.max(toCents(input.shippingFlatFee), 0);

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    taxRate: TAX_RATE,
    tax: fromCents(taxCents),
    shipping: fromCents(shippingCents),
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    total: fromCents(baseCents + taxCents + shippingCents),
  };
}

/**
 * Lee la tarifa de envío de `SHIPPING_FLAT_FEE`. Vacía, no numérica o
 * negativa → `DEFAULT_SHIPPING_FLAT_FEE` (5). Se redondea al céntimo.
 * `onInvalid` se llama si la variable está definida pero no vale (para que la
 * capa de aplicación lo registre sin que el dominio dependa de Nest).
 */
export function parseShippingFlatFee(
  raw: string | undefined,
  onInvalid?: (raw: string) => void,
): number {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_SHIPPING_FLAT_FEE;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    onInvalid?.(trimmed);
    return DEFAULT_SHIPPING_FLAT_FEE;
  }
  return fromCents(toCents(value));
}
