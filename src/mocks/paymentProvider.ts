/**
 * MOCK payment provider. No money moves. Deterministic success, and it records
 * idempotency keys so a replayed request returns the original result instead of
 * paying twice - the shape of the real integration, none of the risk.
 */
export interface RefundRequest {
  readonly idempotencyKey: string;
  readonly amountCents: number;
  readonly customerReference: string;
}

export interface RefundResult {
  readonly status: 'succeeded';
  readonly reference: string;
  readonly replayed: boolean;
  readonly idempotencyKey: string;
}

const seen = new Map<string, RefundResult>();

export function refund(request: RefundRequest): RefundResult {
  const existing = seen.get(request.idempotencyKey);
  if (existing) {
    console.log(`[MOCK PAYMENT PROVIDER] replay idempotency_key=${request.idempotencyKey} -> ${existing.reference}`);
    return { ...existing, replayed: true };
  }
  const result: RefundResult = {
    status: 'succeeded',
    reference: `mock_pi_${Buffer.from(request.idempotencyKey).toString('hex').slice(0, 12)}`,
    replayed: false,
    idempotencyKey: request.idempotencyKey,
  };
  seen.set(request.idempotencyKey, result);
  console.log(
    `[MOCK PAYMENT PROVIDER] refund amount_cents=${request.amountCents} customer=${request.customerReference} ` +
      `idempotency_key=${request.idempotencyKey} -> ${result.status} ${result.reference}`,
  );
  return result;
}

export function reset(): void {
  seen.clear();
}
