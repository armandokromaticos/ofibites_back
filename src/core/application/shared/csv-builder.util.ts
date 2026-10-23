/**
 * Builder de CSV sin librería (T-32a, "Indicadores" de Mi perfil): el repo no
 * trae ninguna dependencia de CSV. Reglas RFC 4180 mínimas: se envuelve en
 * comillas dobles si el valor tiene coma, comilla o salto de línea, y `"` se
 * escapa como `""`.
 */
export function csvEscapeValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Une filas con `,` y `\r\n` (saltos de línea estilo CSV/Excel). */
export function buildCsv(
  rows: (string | number | null | undefined)[][],
): string {
  return rows.map((row) => row.map(csvEscapeValue).join(",")).join("\r\n");
}
