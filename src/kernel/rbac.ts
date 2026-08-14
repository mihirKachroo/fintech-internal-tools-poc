import { ROLE_PERMISSIONS, type Environment, type Permission, type Role } from './config.js';
import { forbidden } from './errors.js';

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Throws unless the role holds the permission. Every mutation route calls this. */
export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw forbidden('PERMISSION_DENIED', `Role '${role}' lacks permission '${permission}'.`);
  }
}

export function flagTogglePermission(environment: Environment): Permission {
  return environment === 'prod' ? 'flag.toggle.prod' : 'flag.toggle.nonprod';
}
