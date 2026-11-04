import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, updateUser, isPlatformAdminEmail } = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  isPlatformAdminEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@dzaroza/database", () => ({
  prisma: { user: { update: updateUser } },
}));
vi.mock("@/lib/platform-admin", () => ({ isPlatformAdminEmail }));

import { getCurrentSession } from "./auth-session";

describe("Better Auth server session authorization claims", () => {
  beforeEach(() => {
    getSession.mockReset();
    updateUser.mockReset();
    isPlatformAdminEmail.mockReset();
  });

  it("revokes stale platform-admin state when the allowlist no longer contains the user", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-a", email: "admin@example.com", isPlatformAdmin: true },
      session: { id: "session-a" },
    });
    isPlatformAdminEmail.mockReturnValue(false);
    updateUser.mockResolvedValue({ id: "user-a", isPlatformAdmin: false });

    const session = await getCurrentSession();

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { isPlatformAdmin: false },
    });
    expect(session?.user.isPlatformAdmin).toBe(false);
  });

  it("does not write when the stored platform-admin state matches the allowlist", async () => {
    getSession.mockResolvedValue({
      user: { id: "admin-a", email: "admin@example.com", isPlatformAdmin: true },
      session: { id: "session-a" },
    });
    isPlatformAdminEmail.mockReturnValue(true);

    const session = await getCurrentSession();

    expect(updateUser).not.toHaveBeenCalled();
    expect(session?.user.isPlatformAdmin).toBe(true);
  });

  it("returns null without a database write when there is no authenticated session", async () => {
    getSession.mockResolvedValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(updateUser).not.toHaveBeenCalled();
    expect(isPlatformAdminEmail).not.toHaveBeenCalled();
  });
});
