import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openStore } from '../src/store.js';

test('staff data survives a database reopen and supports edits', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vtime-store-'));
  const filename = path.join(dir, 'staff.sqlite');
  const person = {
    name: 'Alex', role: 'Management', discordId: '123456789012345678', timeZone: 'Europe/Berlin',
    availableFrom: '13:00', availableUntil: '21:00'
  };
  try {
    let store = openStore(filename);
    const id = store.add(person);
    assert.equal(store.healthy(), true);
    assert.equal(store.list()[0].discord_id, person.discordId);
    assert.equal(store.list()[0].role, 'Management');
    assert.throws(() => store.add(person), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
    store.close();

    store = openStore(filename);
    assert.equal(store.list().length, 1);
    assert.equal(store.update(id, { ...person, name: 'Alexandra', role: 'Moderator' }), true);
    assert.equal(store.list()[0].name, 'Alexandra');
    assert.equal(store.list()[0].role, 'Moderator');
    assert.equal(store.remove(id), true);
    assert.deepEqual(store.list(), []);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existing staff receive a default role without losing data', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vtime-migrate-'));
  const filename = path.join(dir, 'staff.sqlite');
  try {
    const old = new Database(filename);
    old.exec(`CREATE TABLE staff_members (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, discord_id TEXT NOT NULL UNIQUE,
      time_zone TEXT NOT NULL, available_from TEXT NOT NULL, available_until TEXT NOT NULL
    );
    INSERT INTO staff_members (name, discord_id, time_zone, available_from, available_until)
    VALUES ('Existing person', '123456789012345678', 'UTC', '13:00', '21:00');`);
    old.close();

    const store = openStore(filename);
    assert.deepEqual(store.list().map(({ name, role }) => ({ name, role })),
      [{ name: 'Existing person', role: 'Staff' }]);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
