import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { CreateInvoicePaymentUseCase } from "./create-invoice-payment.use-case";
import type { IInvoiceRepository } from "../../../domain/repositories/invoice.repository.interface";
import { InvoiceEntity } from "../../../domain/entities/invoice.entity";
import { InvoiceRuleException } from "../../../domain/exceptions/invoice-rule.exception";
import { CompanyRole } from "../../../domain/enums/company-role.enum";
import { Role } from "../../../domain/enums/role.enum";
import { InvoiceStatus } from "../../../domain/enums/invoice-status.enum";
import { PaymentMethod } from "../../../domain/enums/payment-method.enum";
import { InvoicePaymentRecordStatus } from "../../../domain/enums/invoice-payment-record-status.enum";
import { CreateInvoicePaymentDto } from "../../dto/invoices/invoice-request.dto";
import { InvoiceActor } from "../../shared/invoice-access";
import {
  InvoiceFileStorageService,
  PAYMENT_PROOF_BUCKET,
} from "../../services/invoice-file-storage.service";
import type { SupabaseService } from "../../../infrastructure/supabase/supabase.service";
import {
  FIXTURE_COMPANY,
  invoice,
  paymentRow,
} from "../../../testing/invoice-fixtures";

const NOW = new Date("2026-10-16T14:00:00.000Z");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const admin: InvoiceActor = {
  userId: "user-1",
  role: Role.CLIENT,
  member: {
    companyId: FIXTURE_COMPANY,
    role: CompanyRole.COMPANY_ADMIN,
    canPayInvoices: false,
  },
};

const dto = (overrides: Partial<CreateInvoicePaymentDto> = {}) =>
  ({
    paymentDate: "2026-10-15",
    method: PaymentMethod.MOBILE_PAYMENT,
    reference: "0102-88431",
    amount: 100,
    ...overrides,
  }) as CreateInvoicePaymentDto;

const file = (
  overrides: Partial<{ buffer: Buffer; mimetype: string; size: number }> = {},
) => ({
  buffer: JPG,
  mimetype: "image/jpeg",
  originalname: "comprobante.jpg",
  size: JPG.length,
  ...overrides,
});

function setup(current: InvoiceEntity) {
  const repo = {
    findById: jest.fn(() => Promise.resolve(current)),
    createPayment: jest.fn(() => Promise.resolve(current)),
  };
  const supabase = {
    uploadPrivateFile: jest.fn((_b: string, path: string) =>
      Promise.resolve(path),
    ),
    deleteFile: jest.fn(() => Promise.resolve()),
  };
  const useCase = new CreateInvoicePaymentUseCase(
    repo as unknown as IInvoiceRepository,
    new InvoiceFileStorageService(supabase as unknown as SupabaseService),
  );
  return { useCase, repo, supabase };
}

describe("CreateInvoicePaymentUseCase", () => {
  it("sube el comprobante al bucket privado y crea el pago en USD", async () => {
    const { useCase, repo, supabase } = setup(invoice());
    await useCase.execute(admin, "inv-1", dto(), file(), NOW);

    expect(supabase.uploadPrivateFile).toHaveBeenCalledWith(
      PAYMENT_PROOF_BUCKET,
      expect.stringMatching(/^company-1\/inv-1\/.+\.jpg$/),
      JPG,
      "image/jpeg",
    );
    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        amount: 100,
        paymentDate: new Date("2026-10-15T00:00:00.000Z"),
        proofMimeType: "image/jpeg",
        proofFileName: "comprobante.jpg",
        submittedById: "user-1",
        replacesPaymentId: undefined,
      }),
    );
  });

  it("con un comprobante en revisión y sin replacesPaymentId → 409 PAYMENT_ALREADY_PENDING, sin subir nada", async () => {
    const { useCase, supabase } = setup(invoice({ payments: [paymentRow()] }));
    const error = await useCase
      .execute(admin, "inv-1", dto(), file(), NOW)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "PAYMENT_ALREADY_PENDING",
    });
    expect(supabase.uploadPrivateFile).not.toHaveBeenCalled();
  });

  it("reenvío con replacesPaymentId del pendiente → lo pasa al repositorio (misma transacción)", async () => {
    const { useCase, repo } = setup(
      invoice({ payments: [paymentRow({ id: "pay-1" })] }),
    );
    await useCase.execute(
      admin,
      "inv-1",
      dto({ replacesPaymentId: "pay-1" }),
      file(),
      NOW,
    );
    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ replacesPaymentId: "pay-1" }),
    );
  });

  it("replacesPaymentId que no es el pendiente → 409 PAYMENT_NOT_PENDING", async () => {
    const rejected = paymentRow({
      id: "pay-0",
      status: InvoicePaymentRecordStatus.REJECTED,
    });
    const { useCase } = setup(invoice({ payments: [rejected] }));
    const error = await useCase
      .execute(admin, "inv-1", dto({ replacesPaymentId: "pay-0" }), file(), NOW)
      .catch((e: unknown) => e);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "PAYMENT_NOT_PENDING",
    });
  });

  it("tras un rechazo se puede volver a subir sin replacesPaymentId", async () => {
    const rejected = paymentRow({
      status: InvoicePaymentRecordStatus.REJECTED,
    });
    const { useCase, repo } = setup(invoice({ payments: [rejected] }));
    await useCase.execute(admin, "inv-1", dto(), file(), NOW);
    expect(repo.createPayment).toHaveBeenCalledTimes(1);
  });

  it("si la transacción falla, borra el archivo subido y traduce el error", async () => {
    const { useCase, repo, supabase } = setup(invoice());
    repo.createPayment.mockRejectedValueOnce(
      new InvoiceRuleException("PAYMENT_ALREADY_PENDING"),
    );
    await expect(
      useCase.execute(admin, "inv-1", dto(), file(), NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(supabase.deleteFile).toHaveBeenCalledWith(
      PAYMENT_PROOF_BUCKET,
      expect.stringMatching(/^company-1\/inv-1\//),
    );
  });

  it("monto mayor que el saldo → 400 PAYMENT_AMOUNT_EXCEEDS_BALANCE con el saldo", async () => {
    const { useCase } = setup(invoice({ total: 420.38, amountPaid: 200 }));
    const error = await useCase
      .execute(admin, "inv-1", dto({ amount: 220.39 }), file(), NOW)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "PAYMENT_AMOUNT_EXCEEDS_BALANCE",
      message: expect.stringContaining("$ 220,38") as unknown,
    });
  });

  it("factura pagada o anulada → 409 INVOICE_NOT_PAYABLE", async () => {
    for (const status of [InvoiceStatus.PAID, InvoiceStatus.VOID]) {
      const { useCase } = setup(invoice({ status }));
      const error = await useCase
        .execute(admin, "inv-1", dto(), file(), NOW)
        .catch((e: unknown) => e);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: "INVOICE_NOT_PAYABLE",
      });
    }
  });

  it("fecha del pago futura (Caracas) → 400", async () => {
    const { useCase } = setup(invoice());
    await expect(
      useCase.execute(
        admin,
        "inv-1",
        dto({ paymentDate: "2026-10-17" }),
        file(),
        NOW,
      ),
    ).rejects.toThrow("La fecha del pago no puede ser futura");
  });

  it("archivo: falta, pesa más de 5 MB o la firma no es JPG/PNG/PDF → 400", async () => {
    const { useCase } = setup(invoice());
    await expect(
      useCase.execute(admin, "inv-1", dto(), undefined, NOW),
    ).rejects.toThrow("Sube el comprobante");
    await expect(
      useCase.execute(
        admin,
        "inv-1",
        dto(),
        file({ size: 5 * 1024 * 1024 + 1 }),
        NOW,
      ),
    ).rejects.toThrow("El comprobante no puede pesar más de 5 MB");
    await expect(
      useCase.execute(
        admin,
        "inv-1",
        dto(),
        file({ buffer: Buffer.from("MZ-ejecutable") }),
        NOW,
      ),
    ).rejects.toThrow("El comprobante debe ser JPG, PNG o PDF");
  });

  it("permisos: sin flag → 403; otra empresa → 404", async () => {
    const { useCase } = setup(invoice());
    await expect(
      useCase.execute(
        {
          ...admin,
          member: { ...admin.member!, role: CompanyRole.COMPANY_BUYER },
        },
        "inv-1",
        dto(),
        file(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      useCase.execute(
        { ...admin, member: { ...admin.member!, companyId: "company-2" } },
        "inv-1",
        dto(),
        file(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
