import { UserThrottlerGuard } from "./user-throttler.guard";

/** Expone getTracker (protegido) para probarlo sin montar el módulo. */
class TestableUserThrottlerGuard extends UserThrottlerGuard {
  tracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe("UserThrottlerGuard", () => {
  const guard = new TestableUserThrottlerGuard(
    { throttlers: [] },
    { increment: jest.fn() },
    { getAllAndOverride: jest.fn() } as never,
  );

  it("usa el authId del usuario autenticado como clave", async () => {
    await expect(
      guard.tracker({ ip: "1.2.3.4", user: { authId: "auth-1" } }),
    ).resolves.toBe("user:auth-1");
  });

  it("cae a la IP si no hay usuario", async () => {
    await expect(guard.tracker({ ip: "1.2.3.4" })).resolves.toBe("1.2.3.4");
  });
});
