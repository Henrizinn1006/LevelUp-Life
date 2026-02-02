import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "skillroutine.db");

sqlite3.verbose();
export const db = new sqlite3.Database(DB_PATH);

export function initDB() {
  db.serialize(() => {
    // USERS
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Username único (case-insensitive)
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
      ON users(username COLLATE NOCASE)
    `);

    // STATES
    db.run(`
      CREATE TABLE IF NOT EXISTS states (
        user_id INTEGER PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // FRIEND REQUESTS
    db.run(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(from_user_id, to_user_id),
        FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_fr_to ON friend_requests(to_user_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_fr_from ON friend_requests(from_user_id, status)`);
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
