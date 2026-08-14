/**
 * Entity configuration: the "kernel" part of the prototype.
 *
 * Each flow declares its fields, which roles may see which sensitive values, and
 * which columns appear in the list view. Screens, masking and audit are generic
 * over this config, which is what makes the second flow mostly declarative.
 * Config lives in code and is reviewed in git - there is no runtime app designer.
 */

export const ROLES = ['viewer', 'reviewer', 'approver', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export type Permission =
  | 'refund.read'
  | 'refund.request'
  | 'refund.approve'
  | 'flag.read'
  | 'flag.toggle.nonprod'
  | 'flag.toggle.prod'
  | 'audit.read';

/** Deny by default: a role has exactly the permissions listed here. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['refund.read', 'flag.read'],
  reviewer: ['refund.read', 'refund.request', 'flag.read', 'flag.toggle.nonprod', 'audit.read'],
  approver: ['refund.read', 'refund.approve', 'flag.read', 'flag.toggle.nonprod', 'audit.read'],
  admin: [
    'refund.read',
    'refund.request',
    'refund.approve',
    'flag.read',
    'flag.toggle.nonprod',
    'flag.toggle.prod',
    'audit.read',
  ],
};

export type FieldType = 'text' | 'email' | 'money' | 'datetime' | 'status';

export interface FieldConfig {
  readonly name: string;
  readonly label: string;
  readonly type: FieldType;
  /** Shown as a column in the list view. */
  readonly inList?: boolean;
  /**
   * When set, only these roles receive the real value; everyone else receives a
   * masked string. Enforced in the serializer, so masked values never leave the server.
   */
  readonly visibleTo?: readonly Role[];
  /** How much of the value to keep when masking (0 = mask entirely). */
  readonly maskKeepLast?: number;
}

export interface EntityConfig {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly FieldConfig[];
}

export const REFUND_ENTITY: EntityConfig = {
  key: 'refund',
  label: 'Refund request',
  fields: [
    { name: 'id', label: 'ID', type: 'text', inList: true },
    { name: 'customer_name', label: 'Customer', type: 'text', inList: true },
    {
      name: 'customer_email',
      label: 'Customer email',
      type: 'email',
      visibleTo: ['reviewer', 'approver', 'admin'],
    },
    { name: 'amount_cents', label: 'Amount', type: 'money', inList: true },
    { name: 'reason', label: 'Reason', type: 'text' },
    { name: 'status', label: 'Status', type: 'status', inList: true },
    {
      name: 'card_last4',
      label: 'Card',
      type: 'text',
      inList: true,
      visibleTo: ['reviewer', 'approver', 'admin'],
      maskKeepLast: 0,
    },
    {
      name: 'bank_account',
      label: 'Bank account',
      type: 'text',
      visibleTo: ['admin'],
      maskKeepLast: 4,
    },
    { name: 'requested_by', label: 'Requested by', type: 'text', inList: true },
    { name: 'requested_at', label: 'Requested at', type: 'datetime', inList: true },
    { name: 'decided_by', label: 'Decided by', type: 'text' },
    { name: 'decided_at', label: 'Decided at', type: 'datetime' },
    { name: 'decision_reason', label: 'Decision reason', type: 'text' },
    { name: 'provider_reference', label: 'Provider reference (mock)', type: 'text' },
    { name: 'idempotency_key', label: 'Idempotency key (mock)', type: 'text' },
  ],
};

export const FLAG_ENTITY: EntityConfig = {
  key: 'feature_flag',
  label: 'Feature flag',
  fields: [
    { name: 'id', label: 'ID', type: 'text' },
    { name: 'key', label: 'Key', type: 'text', inList: true },
    { name: 'name', label: 'Name', type: 'text', inList: true },
    { name: 'description', label: 'Description', type: 'text' },
    { name: 'owner', label: 'Owner', type: 'text', inList: true },
  ],
};

export const ENTITIES: readonly EntityConfig[] = [REFUND_ENTITY, FLAG_ENTITY];
