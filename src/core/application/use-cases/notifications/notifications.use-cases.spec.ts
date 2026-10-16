import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GetNotificationsUseCase } from "./get-notifications.use-case";
import { MarkNotificationReadUseCase } from "./mark-notification-read.use-case";
import { MarkAllNotificationsReadUseCase } from "./mark-all-notifications-read.use-case";
import type { INotificationRepository } from "../../../domain/repositories/notification.repository.interface";
import { NotificationEntity } from "../../../domain/entities/notification.entity";
import { NotificationType } from "../../../domain/enums/notification-type.enum";
import { OrderStatus } from "../../../domain/enums/order-status.enum";

interface Row {
  id: string;
  userId: string;
  companyId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Repositorio en memoria que interpreta solo las formas de `where` que usan
 * los use-cases (id, userId, readAt null / not null, OR por companyId).
 */
class InMemoryNotificationRepository implements INotificationRepository {
  constructor(public rows: Row[]) {}

  private matches(row: Row, where: Prisma.NotificationWhereInput = {}) {
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (typeof where.userId === "string" && row.userId !== where.userId)
      return false;
    if (where.readAt === null && row.readAt !== null) return false;
    if (Array.isArray(where.OR)) {
      const ok = where.OR.some((cond) =>
        cond.companyId === null
          ? row.companyId === null
          : row.companyId === cond.companyId,
      );
      if (!ok) return false;
    }
    return true;
  }

  private toEntity(row: Row) {
    return NotificationEntity.fromPrisma({
      ...row,
      type: NotificationType.ORDER_STATUS,
      message: `Notificación ${row.id}`,
      link: null,
      orderId: null,
      orderStatus: null,
    });
  }

  findFirst(args: Prisma.NotificationFindFirstArgs) {
    const row = this.rows.find((r) => this.matches(r, args.where));
    return Promise.resolve(row ? this.toEntity(row) : null);
  }

  findMany(args: Prisma.NotificationFindManyArgs = {}) {
    const filtered = this.rows
      .filter((r) => this.matches(r, args.where))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const skip = args.skip ?? 0;
    const page = filtered.slice(skip, skip + (args.take ?? filtered.length));
    return Promise.resolve({
      data: page.map((r) => this.toEntity(r)),
      total: filtered.length,
    });
  }

  count(args: Prisma.NotificationCountArgs) {
    return Promise.resolve(
      this.rows.filter((r) => this.matches(r, args.where)).length,
    );
  }

  create(): Promise<NotificationEntity> {
    throw new Error("no usado");
  }

  updateMany(args: Prisma.NotificationUpdateManyArgs) {
    const targets = this.rows.filter((r) => this.matches(r, args.where));
    for (const row of targets) {
      row.readAt = args.data.readAt as Date;
    }
    return Promise.resolve(targets.length);
  }
}

const READ_AT = new Date("2026-10-10T12:00:00.000Z");

function seed(): Row[] {
  const at = (minutes: number) =>
    new Date(Date.UTC(2026, 9, 16, 12, minutes, 0));
  return [
    { id: "n1", userId: "u1", companyId: "c1", readAt: null, createdAt: at(1) },
    { id: "n2", userId: "u1", companyId: "c2", readAt: null, createdAt: at(2) },
    { id: "n3", userId: "u1", companyId: null, readAt: null, createdAt: at(3) },
    {
      id: "n4",
      userId: "u1",
      companyId: "c1",
      readAt: READ_AT,
      createdAt: at(4),
    },
    { id: "n5", userId: "u2", companyId: "c1", readAt: null, createdAt: at(5) },
  ];
}

describe("GetNotificationsUseCase", () => {
  it("solo devuelve las del usuario, más recientes primero, con unreadCount total", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const result = await new GetNotificationsUseCase(repo).execute("u1", {});

    expect(result.data.map((n) => n.id)).toEqual(["n4", "n3", "n2", "n1"]);
    expect(result.total).toBe(4);
    expect(result.unreadCount).toBe(3);
  });

  it("unreadCount no depende de la página", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const result = await new GetNotificationsUseCase(repo).execute("u1", {
      skip: 0,
      take: 1,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(4);
    expect(result.unreadCount).toBe(3);
  });

  it("unread=true filtra las leídas", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const result = await new GetNotificationsUseCase(repo).execute("u1", {
      unread: true,
    });

    expect(result.data.map((n) => n.id)).toEqual(["n3", "n2", "n1"]);
    expect(result.total).toBe(3);
  });

  it("con empresa activa devuelve esa empresa más las sin empresa", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const result = await new GetNotificationsUseCase(repo).execute(
      "u1",
      {},
      "c1",
    );

    expect(result.data.map((n) => n.id)).toEqual(["n4", "n3", "n1"]);
    expect(result.unreadCount).toBe(2);
  });

  it("acota take a 50 y usa 20 por defecto", async () => {
    const repo = {
      findMany: jest.fn(() => Promise.resolve({ data: [], total: 0 })),
      count: jest.fn(() => Promise.resolve(0)),
    };
    const useCase = new GetNotificationsUseCase(
      repo as unknown as INotificationRepository,
    );

    await useCase.execute("u1", { take: 500 });
    await useCase.execute("u1", {});

    expect(repo.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ skip: 0, take: 50 }),
    );
    expect(repo.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 20 }),
    );
  });
});

describe("MarkNotificationReadUseCase", () => {
  it("marca como leída una notificación propia", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const result = await new MarkNotificationReadUseCase(repo).execute(
      "n1",
      "u1",
    );

    expect(result.id).toBe("n1");
    expect(result.readAt).toBeInstanceOf(Date);
  });

  it("es idempotente: si ya estaba leída conserva su readAt", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    const spy = jest.spyOn(repo, "updateMany");
    const result = await new MarkNotificationReadUseCase(repo).execute(
      "n4",
      "u1",
    );

    expect(result.readAt).toEqual(READ_AT);
    expect(spy).not.toHaveBeenCalled();
  });

  it("404 si la notificación es de otro usuario, sin modificarla", async () => {
    const rows = seed();
    const repo = new InMemoryNotificationRepository(rows);

    await expect(
      new MarkNotificationReadUseCase(repo).execute("n5", "u1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rows.find((r) => r.id === "n5")?.readAt).toBeNull();
  });

  it("404 si no existe", async () => {
    const repo = new InMemoryNotificationRepository(seed());
    await expect(
      new MarkNotificationReadUseCase(repo).execute("nada", "u1"),
    ).rejects.toThrow("Notificación no encontrada");
  });
});

describe("MarkAllNotificationsReadUseCase", () => {
  it("marca solo las no leídas del usuario y devuelve cuántas", async () => {
    const rows = seed();
    const repo = new InMemoryNotificationRepository(rows);
    const result = await new MarkAllNotificationsReadUseCase(repo).execute(
      "u1",
    );

    expect(result).toEqual({ updated: 3 });
    expect(rows.find((r) => r.id === "n4")?.readAt).toEqual(READ_AT);
    expect(rows.find((r) => r.id === "n5")?.readAt).toBeNull();
    const after = await new GetNotificationsUseCase(repo).execute("u1", {});
    expect(after.unreadCount).toBe(0);
  });

  it("con empresa activa respeta el mismo alcance que el listado", async () => {
    const rows = seed();
    const repo = new InMemoryNotificationRepository(rows);
    const result = await new MarkAllNotificationsReadUseCase(repo).execute(
      "u1",
      "c1",
    );

    expect(result).toEqual({ updated: 2 });
    expect(rows.find((r) => r.id === "n2")?.readAt).toBeNull();
  });
});

describe("NotificationEntity.toResponseDto", () => {
  it("expone orderNumber (últimos 8 del id) y link al pedido", () => {
    const dto = NotificationEntity.fromPrisma({
      id: "n1",
      userId: "u1",
      companyId: "c1",
      type: NotificationType.ORDER_STATUS,
      message: "Tu pedido va en camino.",
      link: "/pedidos/0f8fad5b-d9cb-469f-a165-70867728950e",
      orderId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      orderStatus: OrderStatus.IN_TRANSIT,
      readAt: null,
      createdAt: new Date("2026-10-16T14:00:00.000Z"),
    }).toResponseDto();

    expect(dto).toEqual({
      id: "n1",
      type: "ORDER_STATUS",
      message: "Tu pedido va en camino.",
      link: "/pedidos/0f8fad5b-d9cb-469f-a165-70867728950e",
      orderId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      orderNumber: "7728950E",
      orderStatus: "IN_TRANSIT",
      companyId: "c1",
      readAt: null,
      createdAt: "2026-10-16T14:00:00.000Z",
    });
  });
});
