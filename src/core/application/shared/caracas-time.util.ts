// Cortes de día/mes para los dashboards en hora de Venezuela.
// America/Caracas es UTC-4 fijo (sin horario de verano desde 2016).
const CARACAS_OFFSET_MINUTES = -4 * 60;
const MS_PER_MINUTE = 60_000;

/** Devuelve "YYYY-MM-DD" del instante expresado en hora de Caracas. */
export function toCaracasDateKey(date: Date): string {
  const shifted = new Date(
    date.getTime() + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  return shifted.toISOString().slice(0, 10);
}

/** Año calendario del instante en hora de Caracas (para `OF-AAAA-NNNN`). */
export function caracasYear(date: Date = new Date()): number {
  return new Date(
    date.getTime() + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  ).getUTCFullYear();
}

/** Minutos transcurridos desde la medianoche de Caracas (0..1439). */
export function caracasMinutesOfDay(date: Date = new Date()): number {
  const shifted = new Date(
    date.getTime() + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** "YYYY-MM-DD" de Caracas desplazado `days` días (hoy = 0, mañana = 1). */
export function caracasDateKeyPlusDays(
  days: number,
  now: Date = new Date(),
): string {
  const todayUtc = Date.parse(`${toCaracasDateKey(now)}T00:00:00.000Z`);
  return new Date(todayUtc + days * 24 * 60 * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/**
 * Rango [monthStart, monthEnd) del mes calendario actual en Caracas,
 * como instantes UTC listos para usar en filtros de Prisma.
 */
export function caracasMonthRange(now: Date = new Date()): {
  monthStart: Date;
  monthEnd: Date;
} {
  const shifted = new Date(
    now.getTime() + CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  // Medianoche Caracas del día 1 = restar el offset al UTC de ese día 1.
  const monthStart = new Date(
    Date.UTC(year, month, 1) - CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  const monthEnd = new Date(
    Date.UTC(year, month + 1, 1) - CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  return { monthStart, monthEnd };
}

/**
 * Rango [dayStart, dayEnd) de "hoy" según el calendario de Caracas, pero con
 * límites a medianoche UTC. Pensado para columnas `@db.Date` (p. ej.
 * `Order.deliveryDate`), que Prisma persiste como medianoche UTC de esa fecha.
 */
export function caracasTodayDateRange(now: Date = new Date()): {
  dayStart: Date;
  dayEnd: Date;
} {
  const dayStart = new Date(`${toCaracasDateKey(now)}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MS_PER_MINUTE);
  return { dayStart, dayEnd };
}

/**
 * Medianoche (hora de Caracas) del día que cae `days` días antes de hoy en
 * Caracas, como instante UTC. Sirve de corte inclusivo para "últimos N días"
 * sobre columnas `DateTime` (p. ej. `createdAt >= corte`).
 */
export function caracasDayStartDaysAgo(
  days: number,
  now: Date = new Date(),
): Date {
  const todayStartUtc = Date.parse(`${toCaracasDateKey(now)}T00:00:00.000Z`);
  return new Date(
    todayStartUtc -
      days * 24 * 60 * MS_PER_MINUTE -
      CARACAS_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}
