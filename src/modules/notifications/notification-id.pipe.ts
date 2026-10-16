import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";

/** `:id` de notificación: UUID o 400 en español. */
export function notificationIdPipe(): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException("El id de la notificación no es válido"),
  });
}
