import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireTenantRole, createTransaction } = vi.hoisted(() => ({
  prisma: {
    invoice: { findFirst: vi.fn() },
    paymentTransaction: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  requireTenantRole: vi.fn(),
  createTransaction: vi.fn(),
}));
vi.mock("@dzaroza/database", () => ({
  prisma,
  MembershipRole: { OWNER: "OWNER", ADMIN: "ADMIN", FINANCE: "FINANCE" },
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@/lib/tenant", () => ({
  requireTenantRole,
  toHttpError: () => ({ status: 500, message: "Server error" }),
}));
vi.mock("midtrans-client", () => ({
  default: { Snap: vi.fn(() => ({ createTransaction })) },
}));
import { POST } from "./route";

const context = { params: Promise.resolve({ organizationId: "org-a", invoiceId: "invoice-a" }) };
const request = () => new Request("http://localhost/api/checkout", { method: "POST" }) as never;
const remaining = {
  toDecimalPlaces: () => ({ greaterThan: () => true, isInteger: () => true, toNumber: () => 250000, toString: () => "250000" }),
};
const invoice = {
  id: "invoice-a", organizationId: "org-a", number: "INV-1", status: "SENT",
  total: { minus: () => remaining }, paidAmount: { toString: () => "0" },
  project: { client: { name: "Klien", email: "klien@example.test", phone: "0812345678" } },
  quotation: null,
};

describe("Midtrans invoice checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = "test-server-key";
    process.env.MIDTRANS_CLIENT_KEY = "test-client-key";
    process.env.MIDTRANS_IS_PRODUCTION = "false";
    requireTenantRole.mockResolvedValue({ organizationId: "org-a", userId: "user-a" });
    prisma.invoice.findFirst.mockResolvedValue(invoice);
    prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    prisma.paymentTransaction.create.mockResolvedValue({ id: "payment-a" });
    prisma.paymentTransaction.update.mockResolvedValue({ id: "payment-a" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-a" });
    createTransaction.mockResolvedValue({ token: "snap-token", redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/token" });
    const tx = {
      invoice: { findFirst: prisma.invoice.findFirst },
      paymentTransaction: { findFirst: prisma.paymentTransaction.findFirst, create: prisma.paymentTransaction.create },
      auditLog: { create: prisma.auditLog.create },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  });

  it("creates a pending payment record and a Midtrans Snap checkout", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({ paymentId: "payment-a", snapToken: "snap-token", redirectUrl: expect.stringContaining("midtrans"), orderId: expect.stringMatching(/^DZINV-/) });
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-a", invoiceId: "invoice-a", provider: "MIDTRANS", status: "PENDING", amount: expect.anything() }),
    }));
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      transaction_details: { order_id: payload.orderId, gross_amount: 250000 },
      customer_details: expect.objectContaining({ email: "klien@example.test" }),
    }));
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-a" }, data: { checkoutToken: "snap-token", checkoutUrl: expect.stringContaining("midtrans") },
    }));
  });

  it("reuses an existing unexpired pending checkout instead of creating another order", async () => {
    prisma.paymentTransaction.findFirst.mockResolvedValue({ id: "payment-existing", providerOrderId: "DZINV-EXISTING", checkoutToken: "old-token", checkoutUrl: "https://example.test/checkout" });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ paymentId: "payment-existing", snapToken: "old-token", reused: true });
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("does not create a checkout for draft invoices", async () => {
    prisma.invoice.findFirst.mockResolvedValue({ ...invoice, status: "DRAFT" });
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
