import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";

/**
 * Añade `Server-Timing: total;dur=<ms>`. Mide desde el inicio que deja el
 * middleware de log HTTP de `AppModule` (así incluye los guards); si no está,
 * desde que entra al interceptor. Las requests rechazadas por un guard no
 * pasan por interceptores y salen sin la cabecera.
 */
@Injectable()
export class ServerTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const inicio =
      (request["inicioPeticion"] as number | undefined) ?? Date.now();

    const ponerCabecera = () => {
      if (!response.headersSent) {
        response.setHeader("Server-Timing", `total;dur=${Date.now() - inicio}`);
      }
    };

    return next
      .handle()
      .pipe(tap({ next: ponerCabecera, error: ponerCabecera }));
  }
}
