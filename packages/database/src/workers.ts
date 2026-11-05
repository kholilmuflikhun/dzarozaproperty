import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/workers/client";

/**
 * Creates an isolated Prisma client for one Workers request.
 *
 * Do not cache this client at module scope: Workers requests must not reuse
 * driver sockets from a previous request. The caller owns cleanup and must
 * schedule/await prisma.$disconnect() in its request-finalization path.
 */
export function createWorkersPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString.trim()) {
    throw new Error("A Neon connection string is required for the Workers Prisma client.");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}
