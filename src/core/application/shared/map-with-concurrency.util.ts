/** Líneas de carrito u orden que se procesan a la vez (cada una lanza 5–6 consultas). */
export const LINE_CONCURRENCY = 4;

/**
 * Como `Promise.all(items.map(fn))`, pero con como mucho `limit` llamadas en
 * curso: no agota el pool de conexiones de Prisma con carritos grandes. Los
 * resultados salen en el orden de `items`. Ante el primer error (en el
 * tiempo, como `Promise.all`) rechaza y no arranca más elementos.
 */
export function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  const worker = async (): Promise<void> => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    () => worker(),
  );
  return Promise.all(workers).then(() => results);
}
