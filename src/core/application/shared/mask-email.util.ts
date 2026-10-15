/** Enmascara un email para logs sin filtrar PII: "j***@dominio.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  return `${local.slice(0, 1)}***@${domain}`;
}
