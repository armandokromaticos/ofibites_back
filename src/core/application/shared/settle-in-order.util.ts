/**
 * Como `Promise.all`, pero espera a todas y, si varias fallan, lanza el error
 * de la primera **de la lista** (no la primera en fallar en el tiempo). Sirve
 * para lanzar en paralelo validaciones de solo lectura sin cambiar qué error
 * recibe el cliente respecto a ejecutarlas una tras otra.
 */
export async function settleInOrder<T extends readonly unknown[] | []>(
  promises: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const results = await Promise.allSettled(promises);
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
  return results.map(
    (result) => (result as PromiseFulfilledResult<unknown>).value,
  ) as { -readonly [K in keyof T]: Awaited<T[K]> };
}
