import { BadRequestException } from "@nestjs/common";
import { isUUID } from "class-validator";

/**
 * Header `X-Company-Id` opcional: vacío u omitido → undefined; si viene, debe
 * ser un UUID (400 en español si no).
 */
export function parseOptionalCompanyIdHeader(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!isUUID(trimmed)) {
    throw new BadRequestException("X-Company-Id debe ser un UUID válido");
  }
  return trimmed;
}
