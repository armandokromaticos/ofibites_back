/** Métodos de pago manual (DECISIONES 2026-11-04, T-06 respuestas, 4). */
export enum PaymentMethod {
  /** Pago Móvil */
  MOBILE_PAYMENT = "MOBILE_PAYMENT",
  /** Transferencia en Bs */
  TRANSFER_VES = "TRANSFER_VES",
  /** Transferencia en divisas */
  TRANSFER_USD = "TRANSFER_USD",
  ZELLE = "ZELLE",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.MOBILE_PAYMENT]: "Pago Móvil",
  [PaymentMethod.TRANSFER_VES]: "Transferencia en Bs",
  [PaymentMethod.TRANSFER_USD]: "Transferencia en divisas",
  [PaymentMethod.ZELLE]: "Zelle",
};
