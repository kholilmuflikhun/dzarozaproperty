import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDisconnect, mockClient, mockPrismaClientConstructor } = vi.hoisted(() => {
  const mockDisconnect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const mockClient = { $disconnect: mockDisconnect };
  const mockPrismaClientConstructor = vi.fn();
  return { mockDisconnect, mockClient, mockPrismaClientConstructor };
});

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: class PrismaNeonMock {
    constructor(_options: unknown) {}
  },
}));

vi.mock("../../../../../packages/database/generated/workers/client", () => ({
  PrismaClient: class PrismaClientMock {
    constructor(options: unknown) {
      mockPrismaClientConstructor(options);
      return mockClient;
    }
  },
}));

import { createWorkersPrismaClient, withWorkersPrisma } from "../../../../../packages/database/src/workers";

describe("Workers Prisma request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
  });

  it("rejects an empty Neon connection string before creating a client", () => {
    expect(() => createWorkersPrismaClient("  ")).toThrow(
      "A Neon connection string is required for the Workers Prisma client.",
    );
    expect(mockPrismaClientConstructor).not.toHaveBeenCalled();
  });

  it("creates a request client with a Neon adapter for a valid connection string", () => {
    const client = createWorkersPrismaClient("postgresql://preview.example/db");

    expect(client).toBe(mockClient);
    expect(mockPrismaClientConstructor).toHaveBeenCalledTimes(1);
    expect(mockPrismaClientConstructor).toHaveBeenCalledWith({
      adapter: expect.any(Object),
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
