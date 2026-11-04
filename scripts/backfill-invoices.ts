/**
 * T-06 · Backfill de facturas (DECISIONES 2026-11-04, T-06 respuestas, 7).
 *
 * Emite factura a los pedidos en CONFIRMED, IN_PREPARATION o IN_TRANSIT que
 * aún no la tienen, con la misma función que usa la transición a CONFIRMED
 * (`issueInvoiceWithin`): número F-AAAA-NNNN del contador, foto de importes y
 * datos fiscales, `creditDays` actual de la empresa y vencimiento por la regla
 * de contado (día de entrega) o crédito (hoy + creditDays). Los DELIVERED,
 * CANCELLED y REJECTED se quedan sin factura. No envía notificaciones.
 *
 * Cada pedido va en su transacción con la fila bloqueada (`FOR UPDATE`): si
 * ya no está en un estado a facturar, se salta. Una factura de total 0 nace
 * pagada (PAID), como en la emisión normal.
 *
 * Idempotente: un pedido que ya tiene factura se salta (la función no crea
 * otra y el índice único de `orderId` lo garantiza en BD).
 *
 * Uso (después de aplicar la migración 20261104_facturas_pagos):
 *   yarn ts-node scripts/backfill-invoices.ts --dry-run   # solo lista
 *   yarn ts-node scripts/backfill-invoices.ts             # emite
 *
 * Ojo: en empresas de contado un pedido con entrega pasada queda vencido en
 * cuanto se emite y bloquea el checkout de esa empresa. Revisa el --dry-run
 * con Ofibites antes de correrlo de verdad.
 */
import { PrismaClient } from "@prisma/client";
import { issueInvoiceWithin } from "../src/core/infrastructure/repositories/invoice.repository";
import { computeInvoiceDueDate } from "../src/core/domain/services/invoice-rules";

const BACKFILL_STATUSES = [
  "CONFIRMED",
  "IN_PREPARATION",
  "IN_TRANSIT",
] as const;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  const now = new Date();
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: [...BACKFILL_STATUSES] }, invoice: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryDate: true,
        total: true,
        company: { select: { legalName: true, creditDays: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(
      `${dryRun ? "[dry-run] " : ""}${orders.length} pedido(s) sin factura en ${BACKFILL_STATUSES.join(", ")}`,
    );

    let issued = 0;
    let skipped = 0;
    let failed = 0;
    let changed = 0;
    for (const order of orders) {
      const due = computeInvoiceDueDate({
        creditDays: order.company.creditDays,
        deliveryDate: order.deliveryDate,
        issuedAt: now,
      });
      const label = `${order.orderNumber ?? order.id} (${order.status}, ${order.company.legalName}, total ${order.total.toString()}, vence ${due.toISOString().slice(0, 10)})`;
      if (dryRun) {
        console.log(`  emitiría: ${label}`);
        continue;
      }
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            // Bloquea el pedido (igual que OrderRepository.updateStatus) y
            // revisa que siga en un estado a facturar: si lo cancelaron o
            // entregaron mientras tanto, se salta.
            const rows = await tx.$queryRaw<{ status: string }[]>`
              SELECT "status"::text AS "status" FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
            const current = rows[0]?.status;
            if (
              !current ||
              !(BACKFILL_STATUSES as readonly string[]).includes(current)
            ) {
              return "status_changed" as const;
            }
            const invoiceId = await issueInvoiceWithin(tx, order.id, now);
            return invoiceId ? ("issued" as const) : ("exists" as const);
          },
          { timeout: 15000 },
        );
        if (result === "status_changed") {
          changed += 1;
          console.log(`  cambió de estado, se salta: ${label}`);
        } else if (result === "issued") {
          issued += 1;
          console.log(`  emitida: ${label}`);
        } else {
          skipped += 1;
          console.log(`  ya tenía factura: ${label}`);
        }
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "P2002") {
          skipped += 1;
          console.log(`  ya tenía factura (P2002): ${label}`);
        } else {
          failed += 1;
          console.error(`  ERROR en ${label}:`, error);
        }
      }
    }

    if (!dryRun) {
      console.log(
        `Emitidas: ${issued} · ya tenían factura: ${skipped} · cambiaron de estado: ${changed} · con error: ${failed}`,
      );
    }
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
