import { BadRequestException, Type, ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "class-validator";

/**
 * Valida el body contra `dto` rechazando (400) los campos que el DTO no
 * declara, en vez de descartarlos en silencio como el ValidationPipe global.
 *
 * Para que funcione, el parámetro del controller debe tiparse como
 * `Record<string, unknown>` (no como el DTO): el pipe global solo valida
 * parámetros con una clase como metatipo, así que no llega a quitar los
 * campos extra antes de que este pipe los vea. Documenta el body con
 * `@ApiBody({ type: dto })`.
 */
export function strictBodyPipe(dto: Type<unknown>): ValidationPipe {
  return new ValidationPipe({
    expectedType: dto,
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException(
        errors.flatMap((error) =>
          Object.entries(error.constraints ?? {}).map(([key, message]) =>
            key === "whitelistValidation"
              ? `${error.property} no se puede editar aquí`
              : message,
          ),
        ),
      ),
  });
}
