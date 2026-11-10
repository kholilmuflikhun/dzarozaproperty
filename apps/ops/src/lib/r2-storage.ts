import { randomUUID } from "node:crypto";

const DEFAULT_UPLOAD_TTL_SECONDS = 300;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 300;
const MAX_PRESIGN_TTL_SECONDS = 900;

export type R2ObjectMethod = "PUT" | "GET" | "HEAD" | "DELETE";

export interface R2ObjectUrl {
  url: string;
  method: R2ObjectMethod;
  expiresIn: number;
  headers?: Record<string, string>;
}

interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: URL;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getConfig(): R2Config {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("R2_ACCOUNT_ID must be a 32-character hexadecimal account ID.");
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket)) throw new Error("R2_BUCKET_NAME is invalid.");

  const endpointValue = process.env.R2_ENDPOINT?.trim()
    || `https://${accountId}.r2.cloudflarestorage.com`;
  const endpoint = new URL(endpointValue);
  if (
    endpoint.protocol !== "https:"
    || endpoint.hostname !== `${accountId}.r2.cloudflarestorage.com`
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || endpoint.port
    || endpoint.pathname !== "/"
  ) {
    throw new Error("R2_ENDPOINT must be the HTTPS S3 endpoint for the configured Cloudflare account.");
  }

  return { accountId, bucket, accessKeyId, secretAccessKey, endpoint };
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function hmac(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const rawKeyBuffer = new ArrayBuffer(rawKey.byteLength);
  new Uint8Array(rawKeyBuffer).set(rawKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

function canonicalQuery(params: URLSearchParams): string {
  return Array.from(params.entries())
    .sort(([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB),
    )
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

async function signObjectUrl(
  method: R2ObjectMethod,
  objectKey: string,
  expiresIn: number,
  contentType?: string,
  ifNoneMatch?: string,
): Promise<R2ObjectUrl> {
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_PRESIGN_TTL_SECONDS) {
    throw new Error(`Presigned URL expiry must be between 1 and ${MAX_PRESIGN_TTL_SECONDS} seconds.`);
  }
  if (!objectKey || objectKey.startsWith("/") || objectKey.includes("\\") || objectKey.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("R2 object key is invalid.");
  }

  const config = getConfig();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const url = new URL(config.endpoint.toString());
  const encodedKey = objectKey.split("/").map(encodeRfc3986).join("/");
  url.pathname = `/${config.bucket}/${encodedKey}`;

  const signedHeaderNames = [
    ...(contentType ? ["content-type"] : []),
    ...(ifNoneMatch ? ["if-none-match"] : []),
    "host",
  ].sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = [
    ...(contentType ? [`content-type:${contentType.trim()}\n`] : []),
    `host:${url.host}\n`,
    ...(ifNoneMatch ? [`if-none-match:${ifNoneMatch.trim()}\n`] : []),
  ].join("");

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const query = canonicalQuery(params);
  const canonicalRequest = [
    method,
    url.pathname,
    query,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const dateKey = await hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = toHex(await hmac(signingKey, stringToSign));

  params.set("X-Amz-Signature", signature);
  url.search = params.toString();
  return {
    url: url.toString(),
    method,
    expiresIn,
    ...((contentType || ifNoneMatch) ? {
      headers: {
        ...(contentType ? { "Content-Type": contentType.trim() } : {}),
        ...(ifNoneMatch ? { "If-None-Match": ifNoneMatch.trim() } : {}),
      },
    } : {}),
  };
}


export interface R2ObjectMetadata {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
}

export async function headR2Object(objectKey: string): Promise<R2ObjectMetadata | null> {
  const signed = await signObjectUrl("HEAD", objectKey, 60);
  const response = await fetch(signed.url, { method: "HEAD", cache: "no-store" });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) {
    throw new Error(`R2 object verification failed with status ${response.status}.`);
  }

  const rawLength = response.headers.get("content-length");
  const contentLength = rawLength === null ? Number.NaN : Number(rawLength);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error("R2 object returned an invalid content length.");
  }

  return {
    contentLength,
    contentType: response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? null,
    etag: response.headers.get("etag"),
  };
}


export interface R2ObjectBody {
  bytes: Uint8Array;
  contentLength: number;
  contentType: string | null;
  etag: string | null;
}

export async function getR2Object(objectKey: string, maxBytes: number): Promise<R2ObjectBody | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Maximum R2 object size is invalid.");
  }
  const signed = await signObjectUrl("GET", objectKey, 60);
  const response = await fetch(signed.url, { method: "GET", cache: "no-store" });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) {
    throw new Error(`R2 object download verification failed with status ${response.status}.`);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new Error("R2 object returned an invalid or excessive content length.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== declaredLength || bytes.byteLength > maxBytes) {
    throw new Error("R2 object body length does not match its metadata.");
  }

  return {
    bytes,
    contentLength: bytes.byteLength,
    contentType: response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? null,
    etag: response.headers.get("etag"),
  };
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return toHex(new Uint8Array(digest));
}

export function createTenantDocumentKey(organizationId: string, fileName: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(organizationId)) {
    throw new Error("Organization ID is invalid.");
  }
  const normalizedName = fileName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const safeName = !normalizedName || normalizedName === "." || normalizedName === ".."
    ? "document"
    : normalizedName;
  return `organizations/${organizationId}/documents/${randomUUID()}/${safeName}`;
}

export function isTenantDocumentKey(organizationId: string, objectKey: string): boolean {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(organizationId)) return false;
  const segments = objectKey.split("/");
  return segments.length === 5
    && segments[0] === "organizations"
    && segments[1] === organizationId
    && segments[2] === "documents"
    && /^[0-9a-f-]{36}$/i.test(segments[3])
    && /^[a-zA-Z0-9._-]{1,100}$/.test(segments[4])
    && segments[4] !== "."
    && segments[4] !== "..";
}

export function createPresignedUploadUrl(
  objectKey: string,
  expiresIn = DEFAULT_UPLOAD_TTL_SECONDS,
  contentType?: string,
) {
  return signObjectUrl("PUT", objectKey, expiresIn, contentType, "*");
}

export function createPresignedDownloadUrl(objectKey: string, expiresIn = DEFAULT_DOWNLOAD_TTL_SECONDS) {
  return signObjectUrl("GET", objectKey, expiresIn);
}

export function createPresignedDeleteUrl(objectKey: string, expiresIn = DEFAULT_UPLOAD_TTL_SECONDS) {
  return signObjectUrl("DELETE", objectKey, expiresIn);
}
