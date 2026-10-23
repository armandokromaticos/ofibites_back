import { settleInOrder } from "./settle-in-order.util";

const rejectAfter = (ms: number, error: Error) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(error), ms));

describe("settleInOrder", () => {
  it("devuelve los valores en el orden de la lista", async () => {
    await expect(
      settleInOrder([Promise.resolve(1), Promise.resolve("dos")]),
    ).resolves.toEqual([1, "dos"]);
  });

  it("lanza el error de la primera de la lista aunque otra falle antes", async () => {
    const primera = new Error("primera");
    const segunda = new Error("segunda");

    await expect(
      settleInOrder([rejectAfter(20, primera), rejectAfter(0, segunda)]),
    ).rejects.toBe(primera);
  });

  it("espera a todas antes de lanzar", async () => {
    let terminada = false;
    const lenta = new Promise<void>((resolve) =>
      setTimeout(() => {
        terminada = true;
        resolve();
      }, 20),
    );

    await expect(
      settleInOrder([Promise.reject(new Error("x")), lenta]),
    ).rejects.toThrow("x");
    expect(terminada).toBe(true);
  });
});
