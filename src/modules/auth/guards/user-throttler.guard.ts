import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Throttle por usuario autenticado (clave = authId del JWT ya validado), con
 * los mismos límites de `@Throttle` del endpoint. Complementa al
 * `ThrottlerGuard` por IP: va **después** de `JwtAuthGuard`, que es quien deja
 * `request.user.authId`. Sin usuario cae a la IP (no debería pasar).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { authId?: unknown } | undefined;
    if (typeof user?.authId === "string" && user.authId) {
      return Promise.resolve(`user:${user.authId}`);
    }
    return super.getTracker(req);
  }
}
