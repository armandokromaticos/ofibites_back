/**
 * Número legible del pedido: `OF-AAAA-NNNN`, secuencial por año de Caracas.
 * El año sale de `caracasYear` (`caracas-time.util.ts`) y el secuencial del
 * contador `order_number_counters`, dentro de la transacción que crea el
 * pedido (ver `OrderRepository`). Con más de 9999 pedidos en un año el número
 * simplemente crece (`OF-2026-10000`).
 */
export function formatOrderNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Secuencial de pedido inválido: ${sequence}`);
  }
  return `OF-${year}-${String(sequence).padStart(4, "0")}`;
}
