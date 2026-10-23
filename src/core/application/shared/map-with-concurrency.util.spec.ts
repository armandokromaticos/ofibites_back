import { mapWithConcurrency } from "./map-with-concurrency.util";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  it("no supera el límite de llamadas en curso", async () => {
    let enCurso = 0;
    let maximo = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await sleep(5);
      enCurso--;
    });

    expect(maximo).toBe(4);
  });

  it("devuelve los resultados en el orden de entrada aunque terminen desordenados", async () => {
    const result = await mapWithConcurrency([30, 5, 20, 1], 2, async (ms) => {
      await sleep(ms);
      return ms * 10;
    });

    expect(result).toEqual([300, 50, 200, 10]);
  });

  it("propaga el error y no arranca más elementos", async () => {
    const llamados: number[] = [];

    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5], 1, async (n) => {
        llamados.push(n);
        if (n === 2) throw new Error("falla 2");
        await sleep(1);
        return n;
      }),
    ).rejects.toThrow("falla 2");
    expect(llamados).toEqual([1, 2]);
  });

  it("con una lista vacía devuelve una lista vacía", async () => {
    await expect(
      mapWithConcurrency([], 4, () => Promise.resolve(1)),
    ).resolves.toEqual([]);
  });
});
