/**
 * Catálogo de preferencias de notificaciones (T-30e), separado de
 * `NotificationType`/`OrderStatusNotificationService` (las notificaciones
 * in-app reales de cambio de estado de pedido no cambian). Solo persistencia:
 * ningún correo se envía de verdad desde este repo.
 */
export enum NotificationPreferenceType {
  // Grupo "pedidos y facturas": platformEnabled siempre true, no editable.
  ORDER_CONFIRMED_OR_REJECTED = "ORDER_CONFIRMED_OR_REJECTED",
  ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED",
  INVOICE_GENERATED = "INVOICE_GENERATED",
  INVOICE_DUE_SOON_OR_OVERDUE = "INVOICE_DUE_SOON_OR_OVERDUE",
  PAYMENT_STATUS_CHANGED = "PAYMENT_STATUS_CHANGED",
  // Grupo "novedades": los dos canales editables.
  NEW_ASSORTMENT = "NEW_ASSORTMENT",
  QUICK_COFFEE_BREAK_OPTIONS = "QUICK_COFFEE_BREAK_OPTIONS",
  SUGGESTION_FOR_YOU = "SUGGESTION_FOR_YOU",
  TERMS_CHANGES = "TERMS_CHANGES",
}

/**
 * Tipos del grupo "pedidos y facturas": `platformEnabled` siempre `true`
 * en la respuesta y no se puede apagar por PATCH (la campana de la
 * plataforma no se apaga para estos).
 */
export const ALWAYS_PLATFORM_ENABLED_NOTIFICATION_PREFERENCE_TYPES: readonly NotificationPreferenceType[] =
  [
    NotificationPreferenceType.ORDER_CONFIRMED_OR_REJECTED,
    NotificationPreferenceType.ORDER_STATUS_CHANGED,
    NotificationPreferenceType.INVOICE_GENERATED,
    NotificationPreferenceType.INVOICE_DUE_SOON_OR_OVERDUE,
    NotificationPreferenceType.PAYMENT_STATUS_CHANGED,
  ];

export function isAlwaysPlatformEnabledPreferenceType(
  type: NotificationPreferenceType,
): boolean {
  return ALWAYS_PLATFORM_ENABLED_NOTIFICATION_PREFERENCE_TYPES.includes(type);
}
