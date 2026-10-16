/**
 * Tipo de ítem vendible del catálogo. Objeto `as const` (y no `enum`) para que
 * los literales "product" | "combo" sigan siendo asignables al tipo; sirve
 * igual para `ParseEnumPipe` y para Swagger.
 */
export const CATALOG_ITEM_KIND = {
  PRODUCT: "product",
  COMBO: "combo",
} as const;

export type CatalogItemKind =
  (typeof CATALOG_ITEM_KIND)[keyof typeof CATALOG_ITEM_KIND];
