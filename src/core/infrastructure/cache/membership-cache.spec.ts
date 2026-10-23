import type { PrismaService } from "../database/prisma/prisma.service";
import { CompanyMemberRepository } from "../repositories/company-member.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { CompanyMemberEntity } from "../../domain/entities/company-member.entity";
import { CompanyRole } from "../../domain/enums/company-role.enum";
import { AuthUserCacheService } from "./auth-user-cache.service";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    userId: "user-1",
    companyId: "company-1",
    role: CompanyRole.COMPANY_BUYER,
    position: null,
    branchId: null,
    departmentId: null,
    canPayInvoices: false,
    isActive: true,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const member = (overrides: Record<string, unknown> = {}) =>
  CompanyMemberEntity.fromPrisma(row(overrides));

describe("AuthUserCacheService · membresías", () => {
  let cache: AuthUserCacheService;
  let cargar: jest.Mock;
  let ahora: number;

  beforeEach(() => {
    cache = new AuthUserCacheService();
    cargar = jest.fn().mockResolvedValue(member());
    ahora = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => ahora);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("en un acierto no vuelve a cargar de la BD", async () => {
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    const segunda = await cache.obtenerMembresia("user-1", "company-1", cargar);

    expect(segunda?.role).toBe(CompanyRole.COMPANY_BUYER);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("la clave es userId:companyId", async () => {
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-1", "company-2", cargar);
    await cache.obtenerMembresia("user-2", "company-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(3);
  });

  it("recarga cuando la entrada caduca (30 s)", async () => {
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    ahora += 29 * 1000;
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    expect(cargar).toHaveBeenCalledTimes(1);

    ahora += 2 * 1000;
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("invalidarMembresia solo descarta esa clave", async () => {
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-2", "company-1", cargar);
    cache.invalidarMembresia("user-1", "company-1");
    cargar.mockClear();

    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-2", "company-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("invalidarMembresias vacía todo", async () => {
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-2", "company-1", cargar);
    cache.invalidarMembresias();
    cargar.mockClear();

    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-2", "company-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("no cachea el 'no hay membresía activa'", async () => {
    cargar.mockResolvedValue(null);
    await cache.obtenerMembresia("user-1", "company-1", cargar);
    await cache.obtenerMembresia("user-1", "company-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("no guarda una carga que empezó antes de una invalidación", async () => {
    let resolver!: (valor: CompanyMemberEntity) => void;
    const lenta = jest.fn(
      () => new Promise<CompanyMemberEntity>((r) => (resolver = r)),
    );
    const enVuelo = cache.obtenerMembresia("user-1", "company-1", lenta);
    // Mientras tanto se desactiva al miembro.
    cache.invalidarMembresia("user-1", "company-1");
    resolver(member());
    await enVuelo;

    await cache.obtenerMembresia("user-1", "company-1", cargar);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("descarta la entrada menos usada al superar el tamaño máximo", async () => {
    for (let i = 0; i <= 1000; i++) {
      await cache.obtenerMembresia(`user-${i}`, "company-1", cargar);
    }
    cargar.mockClear();

    await cache.obtenerMembresia("user-1000", "company-1", cargar);
    await cache.obtenerMembresia("user-0", "company-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(1);
  });
});

describe("invalidación de la membresía en los repositorios", () => {
  function setup(memberRow = row()) {
    const prisma = {
      companyMember: {
        create: jest.fn().mockResolvedValue(memberRow),
        update: jest.fn().mockResolvedValue(memberRow),
        delete: jest.fn().mockResolvedValue(memberRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(memberRow),
      },
      company: { delete: jest.fn().mockResolvedValue({ id: "company-1" }) },
    };
    const cache = new AuthUserCacheService();
    const repo = new CompanyMemberRepository(
      prisma as unknown as PrismaService,
      cache,
    );
    /** Lo que hace el guard: membresía vía caché. */
    const guardLee = () =>
      cache.obtenerMembresia("user-1", "company-1", () =>
        repo.findActiveByUserAndCompany("user-1", "company-1"),
      );
    return { prisma, cache, repo, guardLee };
  }

  it.each([
    ["create", (repo: CompanyMemberRepository) => repo.create(member())],
    [
      "update",
      (repo: CompanyMemberRepository) =>
        repo.update({ where: { id: "member-1" }, data: { isActive: false } }),
    ],
    ["delete", (repo: CompanyMemberRepository) => repo.delete("member-1")],
  ])(
    "%s invalida la clave (userId, companyId) de la fila afectada",
    async (_op, escribir) => {
      const { cache, repo } = setup(
        row({ userId: "user-7", companyId: "c-7" }),
      );
      const invalidar = jest.spyOn(cache, "invalidarMembresia");

      await escribir(repo);

      expect(invalidar).toHaveBeenCalledWith("user-7", "c-7");
    },
  );

  it("un miembro desactivado pierde el acceso al momento", async () => {
    const { prisma, repo, guardLee } = setup();
    expect(await guardLee()).not.toBeNull();

    prisma.companyMember.update.mockResolvedValue(row({ isActive: false }));
    await repo.update({
      where: { id: "member-1" },
      data: { isActive: false },
    });
    prisma.companyMember.findFirst.mockResolvedValue(null);

    expect(await guardLee()).toBeNull();
  });

  it("un cambio de rol se ve al momento", async () => {
    const { prisma, repo, guardLee } = setup();
    await guardLee();

    const admin = row({ role: CompanyRole.COMPANY_ADMIN });
    prisma.companyMember.update.mockResolvedValue(admin);
    prisma.companyMember.findFirst.mockResolvedValue(admin);
    await repo.update({
      where: { id: "member-1" },
      data: { role: CompanyRole.COMPANY_ADMIN },
    });

    expect((await guardLee())?.role).toBe(CompanyRole.COMPANY_ADMIN);
  });

  it("una invitación aceptada (alta del miembro) se ve al momento", async () => {
    const { prisma, repo, guardLee } = setup();
    prisma.companyMember.findFirst.mockResolvedValue(null);
    expect(await guardLee()).toBeNull();

    await repo.create(member());
    prisma.companyMember.findFirst.mockResolvedValue(row());

    expect(await guardLee()).not.toBeNull();
  });

  it("touchLastSeenIfStale no vacía la caché (solo toca lastSeenAt)", async () => {
    const { prisma, repo, guardLee } = setup();
    await guardLee();

    await repo.touchLastSeenIfStale("auth-1", "company-1", 1000);
    await guardLee();

    expect(prisma.companyMember.findFirst).toHaveBeenCalledTimes(1);
  });

  it("borrar la empresa (cascada sobre sus miembros) vacía la caché", async () => {
    const { prisma, cache, guardLee } = setup();
    await guardLee();

    await new CompanyRepository(
      prisma as unknown as PrismaService,
      cache,
    ).delete("company-1");
    prisma.companyMember.findFirst.mockResolvedValue(null);

    expect(await guardLee()).toBeNull();
  });
});
