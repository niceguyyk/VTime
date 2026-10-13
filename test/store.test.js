import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../src/store.js';

test('staff data survives a database reopen and supports edits', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vtime-store-'));
  const filename = path.join(dir, 'staff.sqlite');
  const person = {
    name: 'Alex', discordId: '123456789012345678', timeZone: 'Europe/Berlin',
    availableFrom: '13:00', availableUntil: '21:00'
  };
  try {
    let store = openStore(filename);
    const id = store.add(person);
    assert.equal(store.healthy(), true);
    assert.equal(store.list()[0].discord_id, person.discordId);
    assert.throws(() => store.add(person), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
    store.close();

    store = openStore(filename);
    assert.equal(store.list().length, 1);
    assert.equal(store.update(id, { ...person, name: 'Alexandra' }), true);
    assert.equal(store.list()[0].name, 'Alexandra');
    assert.equal(store.remove(id), true);
    assert.deepEqual(store.list(), []);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
