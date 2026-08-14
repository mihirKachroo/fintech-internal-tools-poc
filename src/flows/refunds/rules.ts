/** Maker-checker rules for refunds. Kept in one file so the policy is reviewable. */

/** Refunds above this amount require a second, different approver. */
export const APPROVAL_THRESHOLD_CENTS = 50_000;

export function requiresSecondApproval(amountCents: number): boolean {
  return amountCents > APPROVAL_THRESHOLD_CENTS;
}

export function isSelfDecision(requestedBy: string, actorId: string): boolean {
  return requestedBy === actorId;
}
