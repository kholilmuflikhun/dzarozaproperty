import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDisconnect, mockClient, mockNeonConstructor } = vi.hoisted(() => {
  const mockDisconnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const mockClient = { $disconnect: mockDisconnect };
  const mockNeonConstructor = vi.fn();
  return { mockDisconnect, mockClient, mockNeonConstructor };
});

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: class PrismaNeonMock {
    constructor(options: unknown) {
      mockNeonConstructor(options);
      return { options };
    }
  },
}));

vi.mock("../../../../../packages/database/generated/workers/client", () => ({
  PrismaClient: vi.fn(function PrismaClientMock() {
    return mockClient;
  }),
}));

import { createWorkersPrismaClient, withWorkersPrisma } from "../../../../../packages/database/src/workers";

describe("Workers Prisma request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
  });

  it("rejects an empty Neon connection string before creating an adapter", () => {
    expect(() => createWorkersPrismaClient("  ")).toThrow(
      "A Neon connection string is required for the Workers Prisma client.",
    );
    expect(mockNeonConstructor).not.toHaveBeenCalled();
  });

  it("creates a request client using the supplied connection string", () => {
    const client = createWorkersPrismaClient("postgresql://preview.example/db");

    expect(client).toBe(mockClient);
    expect(mockNeonConstructor).toHaveBeenCalledWith({
      connectionString: "postgresql://preview.example/db",
    });
  });

  it("awaits successful work and schedules disconnect on the original execution context", async () => {
    const scheduled: Promise<unknown>[] = [];
    const context = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        scheduled.push(promise);
      }),
    };
    const result = await withWorkersPrisma("postgresql://preview.example/db", context, async (client) => {
      expect(client).toBe(mockClient);
      expect(context.waitUntil).not.toHaveBeenCalled();
      return "completed";
    });

    expect(result).toBe("completed");
    expect(context.waitUntil).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    await expect(scheduled[0]).resolves.toBeUndefined();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("schedules disconnect when the database operation rejects and preserves the operation error", async () => {
    const scheduled: Promise<unknown>[] = [];
    const context = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        scheduled.push(promise);
      }),
    };
    const operationError = new Error("database operation failed");

    await expect(
      withWorkersPrisma("postgresql://preview.example/db", context, async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);

    expect(context.waitUntil).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    await expect(scheduled[0]).resolves.toBeUndefined();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
