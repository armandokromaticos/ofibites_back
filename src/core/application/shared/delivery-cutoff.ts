import {
  caracasDateKeyPlusDays,
  caracasMinutesOfDay,
} from "./caracas-time.util";
import { CheckoutErrorCode } from "./checkout-errors";

export interface DeliveryDateIssue {
  code:
    | typeof CheckoutErrorCode.DELIVERY_CUTOFF
    | typeof CheckoutErrorCode.DELIVERY_HORIZON;
  message: string;
}

/** Hora de corte (Caracas) para agendar la entrega del día siguiente: 15:00. */
export const DELIVERY_CUTOFF_MINUTES = 15 * 60;
/** Máximo de días hacia adelante para agendar una entrega (hoy + 90, inclusive). */
export const DELIVERY_MAX_DAYS_AHEAD = 90;

/**
 * Regla de corte del checkout: la entrega es a partir de mañana (hora de
 * Caracas); si es mañana, la petición tiene que llegar antes de las 15:00 de
 * hoy; y como mucho `DELIVERY_MAX_DAYS_AHEAD` días después de hoy.
 * Se entrega todos los días, fines de semana incluidos (decisión del usuario
 * 2026-10-16); los feriados son otra tarea (T-27).
 * `deliveryDate` es "YYYY-MM-DD" (ya validado por el DTO). Devuelve el código y
 * el mensaje del 400, o null si la fecha vale.
 */
export function deliveryCutoffError(
  deliveryDate: string,
  now: Date = new Date(),
): DeliveryDateIssue | null {
  const tomorrow = caracasDateKeyPlusDays(1, now);
  // Comparación lexicográfica válida para "YYYY-MM-DD".
  if (deliveryDate < tomorrow) {
    return {
      code: CheckoutErrorCode.DELIVERY_CUTOFF,
      message: "La fecha de entrega debe ser a partir de mañana",
    };
  }
  if (
    deliveryDate === tomorrow &&
    caracasMinutesOfDay(now) >= DELIVERY_CUTOFF_MINUTES
  ) {
    return {
      code: CheckoutErrorCode.DELIVERY_CUTOFF,
      message:
        "Los pedidos para mañana se agendan hasta las 3:00 p.m. (hora de Caracas). Elige una fecha posterior",
    };
  }
  if (deliveryDate > caracasDateKeyPlusDays(DELIVERY_MAX_DAYS_AHEAD, now)) {
    return {
      code: CheckoutErrorCode.DELIVERY_HORIZON,
      message: `La fecha de entrega no puede ser más de ${DELIVERY_MAX_DAYS_AHEAD} días después de hoy`,
    };
  }
  return null;
}
