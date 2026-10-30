import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isSuccessfulMidtransPayment, verifyMidtransSignature } from "../midtrans";

describe("Midtrans webhook verification", () => {
  const serverKey = "test-server-secret";
  const base = { order_id: "DZOS-ORDER-1", status_code: "200", gross_amount: "150000.00", transaction_id: "trx-1", transaction_status: "settlement" };
  const signature_key = createHash("sha512").update(base.order_id + base.status_code + base.gross_amount + serverKey).digest("hex");
  it("accepts a valid signature", () => {
    expect(verifyMidtransSignature({ ...base, signature_key }, serverKey)).toBe(true);
  });
  it("rejects an invalid signature", () => {
    expect(verifyMidtransSignature({ ...base, signature_key: "0".repeat(128) }, serverKey)).toBe(false);
  });
  it("treats settlement and accepted capture as successful only", () => {
    expect(isSuccessfulMidtransPayment({ ...base, signature_key })).toBe(true);
    expect(isSuccessfulMidtransPayment({ ...base, transaction_status: "capture", fraud_status: "accept", signature_key })).toBe(true);
    expect(isSuccessfulMidtransPayment({ ...base, transaction_status: "capture", fraud_status: "challenge", signature_key })).toBe(false);
    expect(isSuccessfulMidtransPayment({ ...base, transaction_status: "pending", signature_key })).toBe(false);
  });
});
