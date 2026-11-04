export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  OPS_ADMIN = "OPS_ADMIN",
  /** T-06: valida pagos y sube el PDF fiscal (con SUPER_ADMIN y OPS_ADMIN). */
  FINANCE_ADMIN = "FINANCE_ADMIN",
  OPERATOR = "OPERATOR",
  CLIENT = "CLIENT",
}
