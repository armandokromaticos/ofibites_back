import { ForbiddenException } from "@nestjs/common";
import { assertCanReadOrder } from "./order-read-access";
import type { ICompanyMemberRepository } from "../../domain/repositories/company-member.repository.interface";
import { Role } from "../../domain/enums/role.enum";

function deps(member: boolean) {
  const companyMemberRepository = {
    findActiveByUserAndCompany: jest.fn(() =>
      Promise.resolve(member ? { id: "member-1" } : null),
    ),
  };
  return {
    companyMemberRepository:
      companyMemberRepository as unknown as ICompanyMemberRepository,
    spy: companyMemberRepository.findActiveByUserAndCompany,
  };
}

const order = { userId: "owner-1", companyId: "company-1" };

describe("assertCanReadOrder", () => {
  it.each([Role.SUPER_ADMIN, Role.OPS_ADMIN, Role.OPERATOR])(
    "%s lee cualquier orden sin mirar membresía",
    async (role) => {
      const d = deps(false);
      await expect(
        assertCanReadOrder(order, "otro", role, d),
      ).resolves.toBeUndefined();
      expect(d.spy).not.toHaveBeenCalled();
    },
  );

  it("el dueño la lee", async () => {
    await expect(
      assertCanReadOrder(order, "owner-1", Role.CLIENT, deps(false)),
    ).resolves.toBeUndefined();
  });

  it("un miembro activo de la empresa de la orden la lee", async () => {
    const d = deps(true);
    await expect(
      assertCanReadOrder(order, "buyer-1", Role.CLIENT, d),
    ).resolves.toBeUndefined();
    expect(d.spy).toHaveBeenCalledWith("buyer-1", "company-1");
  });

  it("403 si no es dueño ni miembro", async () => {
    await expect(
      assertCanReadOrder(order, "buyer-1", Role.CLIENT, deps(false)),
    ).rejects.toThrow(new ForbiddenException("No tienes acceso a esta orden"));
  });
});
