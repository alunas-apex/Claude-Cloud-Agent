import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ConversationMessage } from '../types/index.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'agent.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    TEXT    NOT NULL,
    channel   TEXT    NOT NULL DEFAULT 'twilio',
    role      TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
    content   TEXT    NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId, timestamp);

  CREATE TABLE IF NOT EXISTS users (
    userId    TEXT    PRIMARY KEY,
    channel   TEXT    NOT NULL DEFAULT 'twilio',
    name      TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const stmts = {
  insertMessage: db.prepare(
    `INSERT INTO conversations (userId, channel, role, content) VALUES (?, ?, ?, ?)`
  ),
  getHistory: db.prepare(
    `SELECT role, content, timestamp FROM conversations
     WHERE userId = ?
     ORDER BY timestamp DESC
     LIMIT ?`
  ),
  clearHistory: db.prepare(
    `DELETE FROM conversations WHERE userId = ?`
  ),
  upsertUser: db.prepare(
    `INSERT INTO users (userId, channel, name) VALUES (?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET name = excluded.name`
  ),
  getUser: db.prepare(
    `SELECT * FROM users WHERE userId = ?`
  ),
};

export function saveMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  channel = 'twilio'
): void {
  stmts.insertMessage.run(userId, channel, role, content);
}

export function getHistory(userId: string, limit = 20): ConversationMessage[] {
  const rows = stmts.getHistory.all(userId, limit) as {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }[];
  // Return in chronological order (oldest first)
  return rows.reverse().map((r) => ({
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
  }));
}

export function clearHistory(userId: string): void {
  stmts.clearHistory.run(userId);
}

export function upsertUser(userId: string, channel: string, name?: string): void {
  stmts.upsertUser.run(userId, channel, name ?? null);
}

export function getUser(userId: string) {
  return stmts.getUser.get(userId) as { userId: string; channel: string; name?: string } | undefined;
}

