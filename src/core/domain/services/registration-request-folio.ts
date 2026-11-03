/**
 * Folio legible de una solicitud de ingreso: `SOL-AAAA-NNNN`.
 * El año sale de `createdAt` en hora de Caracas (`caracasYear`) y el número
 * es el correlativo global `request_number` (secuencia propia de Postgres, no
 * se reinicia cada año). Con más de 9999 solicitudes el número simplemente
 * crece (`SOL-2026-10000`).
 */
export function formatRegistrationRequestFolio(
  year: number,
  requestNumber: number,
): string {
  if (!Number.isInteger(requestNumber) || requestNumber < 1) {
    throw new Error(`Número de solicitud inválido: ${requestNumber}`);
  }
  return `SOL-${year}-${String(requestNumber).padStart(4, "0")}`;
}
