import { Prisma } from "@prisma/client";

/**
 * `where` base de las notificaciones de un usuario. Siempre filtra por
 * `userId` (aislamiento); con empresa activa (`X-Company-Id`) se limita a esa
 * empresa más las notificaciones sin empresa.
 */
export function notificationScopeWhere(
  userId: string,
  companyId?: string,
): Prisma.NotificationWhereInput {
  if (!companyId) {
    return { userId };
  }
  return { userId, OR: [{ companyId }, { companyId: null }] };
}
