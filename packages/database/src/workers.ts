import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/workers/client";

/** Minimal lifecycle surface exposed by the OpenNext Cloudflare request context. */
export interface WorkersExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Creates an isolated Prisma client for one Workers request.
 *
 * Never cache this client at module scope. The caller must use
 * withWorkersPrisma() or otherwise schedule $disconnect() on the request
 * execution context after its database work has completed.
 */
export function createWorkersPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString.trim()) {
    throw new Error("A Neon connection string is required for the Workers Prisma client.");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Runs request-scoped database work and schedules connection cleanup.
 * The operation is awaited before cleanup is registered, so the response
 * path never races the query/transaction it depends on.
 */
export async function withWorkersPrisma<T>(
  connectionString: string,
  context: WorkersExecutionContext,
  operation: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const prisma = createWorkersPrismaClient(connectionString);

  try {
    return await operation(prisma);
  } finally {
    context.waitUntil(prisma.$disconnect());
  }
}
