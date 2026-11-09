import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

export function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isRedisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "cancelled";

export type Order = {
  orderId: string;
  slug: string;
  grossAmount: number;
  status: OrderStatus;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  midtransToken?: string;
  transactionStatus?: string;
  updatedAt: string;
  createdAt: string;
};

const orderKey = (orderId: string) => `dzaroza:order:${orderId}`;

export async function saveOrder(order: Order) {
  const client = getRedis();
  if (!client) throw new Error("Order storage belum dikonfigurasi.");
  await client.set(orderKey(order.orderId), order, { ex: 60 * 60 * 24 * 90 });
}

export async function getOrder(orderId: string) {
  const client = getRedis();
  if (!client) throw new Error("Order storage belum dikonfigurasi.");
  return client.get<Order>(orderKey(orderId));
}

export async function updateOrder(
  orderId: string,
  update: Partial<Pick<Order, "status" | "transactionStatus" | "midtransToken">>
) {
  const order = await getOrder(orderId);
  if (!order) return null;

  const updated = { ...order, ...update, updatedAt: new Date().toISOString() };
  await saveOrder(updated);
  return updated;
}