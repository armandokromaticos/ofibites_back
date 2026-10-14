import type { TransformFnParams } from "class-transformer";

/**
 * Para `@Transform(trimStringValue)`: recorta espacios si el valor es string
 * y deja pasar cualquier otro tipo para que lo rechace class-validator.
 */
export function trimStringValue({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() : value;
}
