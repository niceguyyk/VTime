const DEPARTMENT_ROLES = Object.freeze({
  moderation: ['Trial Moderator', 'Moderator', 'Senior Moderator', 'Head Moderator'],
  administration: ['Administrator', 'Senior Administrator', 'Head Administrator'],
  'internal-affairs': ['Internal Affairs Agent', 'Senior Internal Affairs Agent', 'Internal Affairs Agent Director'],
  management: ['Managment', 'Senior Managment', 'Managment Director'],
  directorate: ['Assistaint Director', 'Director', 'Deputy Director'],
  oversight: ['Overseer', 'Deputy Overseer']
});

export const STAFF_ROLES = Object.freeze(Object.values(DEPARTMENT_ROLES).flat());

export const ROLE_GROUPS = Object.freeze([
  'all', 'senior', 'leadership',
  'moderation', 'administration', 'internal-affairs',
  'management', 'directorate', 'oversight'
]);

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
  return DEPARTMENT_ROLES[group]?.includes(role) ?? false;
}
