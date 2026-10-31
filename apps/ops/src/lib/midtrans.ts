import { createHash, timingSafeEqual } from "node:crypto";

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string;
  currency?: string;
}

export function verifyMidtransSignature(payload: MidtransNotification, serverKey: string) {
  const received = payload.signature_key?.toLowerCase();
  if (!received || !/^[a-f0-9]{128}$/.test(received)) return false;
  const expected = createHash("sha512")
    .update(payload.order_id + payload.status_code + payload.gross_amount + serverKey)
    .digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isSuccessfulMidtransPayment(payload: MidtransNotification) {
  return payload.transaction_status === "settlement" ||
    (payload.transaction_status === "capture" && payload.fraud_status === "accept");
}

export function storedMidtransPaymentStatus(payload: MidtransNotification) {
  if (payload.transaction_status === "capture" && payload.fraud_status === "challenge") return "CAPTURE_CHALLENGE";
  return payload.transaction_status.toUpperCase();
}

export function canApplyPaymentStatus(currentStatus: string, incomingStatus: string, incomingFraudStatus?: string) {
  const current = currentStatus.toLowerCase();
  const incoming = incomingStatus.toLowerCase();
  const currentSuccessful = current === "settlement" || current === "capture";
  const incomingSuccessful = incoming === "settlement" || (incoming === "capture" && incomingFraudStatus === "accept");
  if (currentSuccessful && !incomingSuccessful) return false;
  if (["expire", "deny", "cancel"].includes(current) && incoming === "pending") return false;
  if (current === "settlement" && incoming === "capture") return false;
  return true;
}
