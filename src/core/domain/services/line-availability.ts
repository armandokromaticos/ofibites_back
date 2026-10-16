/**
 * Regla única de disponibilidad de una línea (carrito u orden): la usan
 * `LineItemAvailabilityService` (al añadir al carrito / crear orden / repetir)
 * y `CartEntity` (`isAvailable` de `GET /cart`), cada una con sus datos ya
 * cargados. Función pura: no consulta nada.
 */

export type LineAvailabilityCode =
  | "UNAVAILABLE"
  | "CONFIGURATION"
  | "NOT_FOUND";

export interface LineAvailabilityIssue {
  code: LineAvailabilityCode;
  /** Mensaje en español para el 400 de `POST /cart/items` / `POST /orders`. */
  message: string;
}

export interface LineAvailabilitySnapshot {
  line: {
    productId: string;
    productSizeId: string | null;
    comboId: string | null;
    modifierIds: string[];
  };
  /** Solo se mira sin combo (un combo se rige por su propio `isActive`). null = no existe. */
  product?: { isActive: boolean; hasActiveSizes: boolean } | null;
  /** El de `productSizeId`. null = no existe. */
  size?: { productId: string; isActive: boolean } | null;
  /** El de `comboId`. null = no existe. */
  combo?: { isActive: boolean; productIds: string[] } | null;
  /** Los encontrados de `modifierIds` (los que falten cuentan como inexistentes). */
  modifiers?: {
    id: string;
    isActive: boolean;
    /** Producto dueño del grupo del modificador; null si no se conoce. */
    groupProductId: string | null;
    sizeRestricted: boolean;
    /** Tamaños con precio propio (`ModifierSizePrice`). */
    pricedSizeIds: string[];
  }[];
}

const issue = (
  code: LineAvailabilityCode,
  message: string,
): LineAvailabilityIssue => ({ code, message });

export function evaluateLineAvailability(
  snapshot: LineAvailabilitySnapshot,
): LineAvailabilityIssue | null {
  const { line } = snapshot;

  if (line.comboId) {
    if (line.productSizeId) {
      return issue(
        "CONFIGURATION",
        "Un combo no admite productSizeId: envía solo comboId",
      );
    }
    if (line.modifierIds.length > 0) {
      return issue(
        "CONFIGURATION",
        "Los combos no admiten modificadores: envía modifiers vacío u omítelo",
      );
    }
    const combo = snapshot.combo;
    if (!combo) {
      return issue("NOT_FOUND", `El combo ${line.comboId} no existe`);
    }
    if (!combo.isActive) {
      return issue(
        "UNAVAILABLE",
        `El combo ${line.comboId} no está disponible`,
      );
    }
    if (!combo.productIds.includes(line.productId)) {
      return issue(
        "UNAVAILABLE",
        `El producto ${line.productId} no forma parte del combo ${line.comboId}`,
      );
    }
    return null;
  }

  const product = snapshot.product;
  if (!product) {
    return issue("NOT_FOUND", `El producto ${line.productId} no existe`);
  }
  if (!product.isActive) {
    return issue(
      "UNAVAILABLE",
      `El producto ${line.productId} no está disponible`,
    );
  }

  if (line.productSizeId) {
    const size = snapshot.size;
    if (!size) {
      return issue("NOT_FOUND", `El tamaño ${line.productSizeId} no existe`);
    }
    if (!size.isActive) {
      return issue(
        "CONFIGURATION",
        `El tamaño ${line.productSizeId} no está disponible`,
      );
    }
    if (size.productId !== line.productId) {
      return issue(
        "CONFIGURATION",
        `El tamaño ${line.productSizeId} no pertenece al producto ${line.productId}`,
      );
    }
  } else if (product.hasActiveSizes) {
    return issue(
      "CONFIGURATION",
      `El producto ${line.productId} tiene tamaños: indica productSizeId`,
    );
  }

  const modifiersById = new Map(
    (snapshot.modifiers ?? []).map((m) => [m.id, m] as const),
  );
  // Primero inactivos (mensaje histórico), luego el resto de reglas.
  for (const modifierId of line.modifierIds) {
    const modifier = modifiersById.get(modifierId);
    if (modifier && !modifier.isActive) {
      return issue(
        "CONFIGURATION",
        `El modificador ${modifierId} no está disponible`,
      );
    }
  }
  for (const modifierId of line.modifierIds) {
    const modifier = modifiersById.get(modifierId);
    if (!modifier) {
      return issue("NOT_FOUND", `El modificador ${modifierId} no existe`);
    }
    if (
      modifier.groupProductId !== null &&
      modifier.groupProductId !== line.productId
    ) {
      return issue(
        "CONFIGURATION",
        `El modificador ${modifierId} no pertenece al producto ${line.productId}`,
      );
    }
    if (
      modifier.sizeRestricted &&
      line.productSizeId &&
      !modifier.pricedSizeIds.includes(line.productSizeId)
    ) {
      return issue(
        "CONFIGURATION",
        `El modificador ${modifierId} no está disponible para el tamaño elegido`,
      );
    }
  }

  return null;
}
