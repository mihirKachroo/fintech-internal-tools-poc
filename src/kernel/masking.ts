import type { EntityConfig, FieldConfig, Role } from './config.js';

export interface MaskedField {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly masked: boolean;
}

const MASK_CHAR = '\u2022';

export function isVisibleTo(field: FieldConfig, role: Role): boolean {
  return field.visibleTo === undefined || field.visibleTo.includes(role);
}

function maskString(raw: string, keepLast: number): string {
  if (keepLast <= 0) return MASK_CHAR.repeat(Math.min(Math.max(raw.length, 4), 8));
  const kept = raw.slice(-keepLast);
  return `${MASK_CHAR.repeat(4)}${kept}`;
}

function format(field: FieldConfig, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '-';
  if (field.type === 'money' && typeof raw === 'number') {
    return `$${(raw / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (field.type === 'datetime' && typeof raw === 'string') return raw.replace('T', ' ').replace('.000Z', 'Z');
  return String(raw);
}

/**
 * Applies role-based field masking. This is the only place row values are turned
 * into output, so a masked value never reaches the response body - the UI is not
 * relied on to hide anything.
 */
export function serializeRow(
  config: EntityConfig,
  row: Record<string, unknown>,
  role: Role,
  options: { listOnly?: boolean } = {},
): MaskedField[] {
  return config.fields
    .filter((field) => !options.listOnly || field.inList === true)
    .map((field) => {
      const raw = row[field.name];
      if (!isVisibleTo(field, role)) {
        const source = raw === null || raw === undefined ? '' : String(raw);
        return {
          name: field.name,
          label: field.label,
          value: source === '' ? '-' : maskString(source, field.maskKeepLast ?? 0),
          masked: true,
        };
      }
      return { name: field.name, label: field.label, value: format(field, raw), masked: false };
    });
}

/** Same masking rules, shaped for JSON responses. */
export function serializeRowToJson(
  config: EntityConfig,
  row: Record<string, unknown>,
  role: Role,
): Record<string, string> {
  return Object.fromEntries(serializeRow(config, row, role).map((field) => [field.name, field.value]));
}
