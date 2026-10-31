import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "../email";

describe("transactional email adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });
  it("reports manual fallback when Resend is not configured", async () => {
    const result = await sendTransactionalEmail({ to: "client@example.test", subject: "Approval", html: "<p>Review</p>", text: "Review" });
    expect(result).toEqual({ sent: false, reason: "not-configured" });
  });
  it("sends through Resend when configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "Dzaroza <noreply@example.test>";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendTransactionalEmail({ to: "client@example.test", subject: "Approval", html: "<p>Review</p>", text: "Review" });
    expect(result).toEqual({ sent: true, messageId: "email-123" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer test-key" }),
    }));
  });
  it("reports provider failure without exposing credentials", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "Dzaroza <noreply@example.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider unavailable", { status: 503 })));
    const result = await sendTransactionalEmail({ to: "client@example.test", subject: "Approval", html: "<p>Review</p>", text: "Review" });
    expect(result).toMatchObject({ sent: false, reason: "provider-error", status: 503 });
    expect(JSON.stringify(result)).not.toContain("test-key");
  });
});
