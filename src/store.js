import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function openStore(filename) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_members (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
      discord_id TEXT NOT NULL UNIQUE,
      time_zone TEXT NOT NULL,
      available_from TEXT NOT NULL DEFAULT '13:00',
      available_until TEXT NOT NULL DEFAULT '21:00',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (available_from < available_until)
    );
  `);

  const list = db.prepare('SELECT id, name, discord_id, time_zone, available_from, available_until FROM staff_members ORDER BY lower(name), id');
  const availability = db.prepare('SELECT time_zone, available_from, available_until FROM staff_members');
  const insert = db.prepare('INSERT INTO staff_members (name, discord_id, time_zone, available_from, available_until) VALUES (?, ?, ?, ?, ?)');
  const update = db.prepare('UPDATE staff_members SET name = ?, discord_id = ?, time_zone = ?, available_from = ?, available_until = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM staff_members WHERE id = ?');

  return {
    healthy: () => db.prepare('SELECT 1').get() !== undefined,
    list: () => list.all(),
    availability: () => availability.all(),
    add: data => Number(insert.run(data.name, data.discordId, data.timeZone, data.availableFrom, data.availableUntil).lastInsertRowid),
    update: (id, data) => update.run(data.name, data.discordId, data.timeZone, data.availableFrom, data.availableUntil, id).changes > 0,
    remove: id => remove.run(id).changes > 0,
    close: () => db.close()
  };
}
