export const STAFF_ROLES = Object.freeze([
  'Trial Moderator',
  'Moderator',
  'Senior Moderator',
  'Head Moderator',
  'Administrator',
  'Senior Administrator',
  'Head Administrator',
  'Internal Affairs Agent',
  'Senior Internal Affairs Agent',
  'Internal Affairs Agent Director',
  'Managment',
  'Senior Managment',
  'Managment Director',
  'Assistaint Director',
  'Director',
  'Deputy Director',
  'Overseer',
  'Deputy Overseer'
]);

export const ROLE_GROUPS = Object.freeze(['all', 'senior', 'leadership']);

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function isRoleGroup(group) {
  return ROLE_GROUPS.includes(group);
}

export function matchesRoleGroup(role, group) {
  if (group === 'all') return true;
  if (!isStaffRole(role)) return false;
  if (group === 'senior') return role.startsWith('Senior ');
  if (group === 'leadership') return role.startsWith('Head ') || role.endsWith('Director') || role.endsWith('Overseer');
  return false;
}
