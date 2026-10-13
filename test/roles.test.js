import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_ROLES, isStaffRole, isRoleGroup, matchesRoleGroup } from '../src/roles.js';

test('only the configured staff roles are accepted', () => {
  assert.equal(STAFF_ROLES.length, 18);
  assert.equal(new Set(STAFF_ROLES).size, STAFF_ROLES.length);
  assert.equal(isStaffRole('Trial Moderator'), true);
  assert.equal(isStaffRole('Managment Director'), true);
  assert.equal(isStaffRole('Custom role'), false);
  assert.equal(isStaffRole('Staff'), false);
});

test('senior and leadership filters select the intended ranks', () => {
  assert.equal(isRoleGroup('senior'), true);
  assert.equal(isRoleGroup('unknown'), false);
  assert.equal(matchesRoleGroup('Senior Moderator', 'senior'), true);
  assert.equal(matchesRoleGroup('Head Moderator', 'senior'), false);
  assert.equal(matchesRoleGroup('Head Administrator', 'leadership'), true);
  assert.equal(matchesRoleGroup('Internal Affairs Agent Director', 'leadership'), true);
  assert.equal(matchesRoleGroup('Deputy Overseer', 'leadership'), true);
  assert.equal(matchesRoleGroup('Moderator', 'leadership'), false);
  assert.equal(matchesRoleGroup('Staff', 'all'), true);
  assert.equal(matchesRoleGroup('Senior Custom', 'senior'), false);
});

test('each current role belongs to exactly one department', () => {
  const departments = ['moderation', 'administration', 'internal-affairs', 'management', 'directorate', 'oversight'];
  for (const group of departments) assert.equal(isRoleGroup(group), true);
  for (const role of STAFF_ROLES) {
    assert.equal(departments.filter(group => matchesRoleGroup(role, group)).length, 1, role);
  }
  assert.equal(matchesRoleGroup('Head Moderator', 'moderation'), true);
  assert.equal(matchesRoleGroup('Internal Affairs Agent Director', 'internal-affairs'), true);
  assert.equal(matchesRoleGroup('Managment Director', 'management'), true);
  assert.equal(matchesRoleGroup('Deputy Director', 'directorate'), true);
  assert.equal(matchesRoleGroup('Deputy Overseer', 'oversight'), true);
  assert.equal(matchesRoleGroup('Staff', 'moderation'), false);
});
