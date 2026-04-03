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

import type BetterSqlite3 from 'better-sqlite3';

const db: BetterSqlite3.Database = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ── Schema Migration ──────────────────────────────────────────────────────────
// Create all tables (IF NOT EXISTS for safe re-runs)

db.exec(`
  -- Original conversation history (kept for backwards compatibility)
  CREATE TABLE IF NOT EXISTS conversations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    TEXT    NOT NULL,
    channel   TEXT    NOT NULL DEFAULT 'twilio',
    role      TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
    content   TEXT    NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId, timestamp);

  -- Original users table (kept for backwards compatibility)
  CREATE TABLE IF NOT EXISTS users (
    userId    TEXT    PRIMARY KEY,
    channel   TEXT    NOT NULL DEFAULT 'twilio',
    name      TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- ── New v2 Tables ────────────────────────────────────────────────────────

  -- Sessions replace simple conversation history for new features
  CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT    PRIMARY KEY,
    userId          TEXT    NOT NULL,
    channel         TEXT    NOT NULL DEFAULT 'webchat',
    title           TEXT,
    modelUsed       TEXT,
    status          TEXT    NOT NULL DEFAULT 'active',
    totalTokensIn   INTEGER NOT NULL DEFAULT 0,
    totalTokensOut  INTEGER NOT NULL DEFAULT 0,
    totalCostUsd    REAL    NOT NULL DEFAULT 0,
    createdAt       INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt       INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId, createdAt);

  -- Messages belong to sessions
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId   TEXT    NOT NULL,
    role        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    metadata    TEXT,
    timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (sessionId) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId, timestamp);

  -- Tool execution audit log
  CREATE TABLE IF NOT EXISTS tool_executions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId   TEXT,
    messageId   INTEGER,
    toolName    TEXT    NOT NULL,
    input       TEXT,
    output      TEXT,
    durationMs  INTEGER,
    status      TEXT    NOT NULL DEFAULT 'success',
    error       TEXT,
    timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (sessionId) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tool_executions_sessionId ON tool_executions(sessionId, timestamp);

  -- Cost tracking ledger
  CREATE TABLE IF NOT EXISTS cost_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId   TEXT,
    model       TEXT    NOT NULL,
    tokensIn    INTEGER NOT NULL DEFAULT 0,
    tokensOut   INTEGER NOT NULL DEFAULT 0,
    costUsd     REAL    NOT NULL DEFAULT 0,
    timestamp   INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_cost_ledger_timestamp ON cost_ledger(timestamp);

  -- Key-value settings store
  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    updatedAt   INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- API key storage (encrypted values)
  CREATE TABLE IF NOT EXISTS api_keys (
    id          TEXT    PRIMARY KEY,
    provider    TEXT    NOT NULL,
    keyHash     TEXT    NOT NULL,
    label       TEXT,
    lastUsedAt  INTEGER,
    createdAt   INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Plugin registry
  CREATE TABLE IF NOT EXISTS plugins (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    version     TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    config      TEXT,
    installedAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- MCP server connections
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    command     TEXT    NOT NULL,
    args        TEXT,
    env         TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    createdAt   INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Prepared Statements (v1 — backwards compatible) ───────────────────────────

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

// ── v1 API (preserved for existing channels like Twilio SMS) ──────────────────

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

// ── v2 API (new session-based) ────────────────────────────────────────────────

const v2Stmts = {
  createSession: db.prepare(
    `INSERT INTO sessions (id, userId, channel, title, modelUsed) VALUES (?, ?, ?, ?, ?)`
  ),
  getSession: db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  listSessions: db.prepare(
    `SELECT * FROM sessions WHERE userId = ? ORDER BY updatedAt DESC LIMIT ?`
  ),
  listAllSessions: db.prepare(
    `SELECT * FROM sessions ORDER BY updatedAt DESC LIMIT ? OFFSET ?`
  ),
  updateSessionCost: db.prepare(
    `UPDATE sessions SET totalTokensIn = totalTokensIn + ?, totalTokensOut = totalTokensOut + ?,
     totalCostUsd = totalCostUsd + ?, updatedAt = unixepoch() WHERE id = ?`
  ),
  updateSessionTitle: db.prepare(
    `UPDATE sessions SET title = ?, updatedAt = unixepoch() WHERE id = ?`
  ),
  archiveSession: db.prepare(
    `UPDATE sessions SET status = 'archived', updatedAt = unixepoch() WHERE id = ?`
  ),
  insertSessionMessage: db.prepare(
    `INSERT INTO messages (sessionId, role, content, metadata) VALUES (?, ?, ?, ?)`
  ),
  getSessionMessages: db.prepare(
    `SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC`
  ),
  logToolExecution: db.prepare(
    `INSERT INTO tool_executions (sessionId, toolName, input, output, durationMs, status, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  getToolExecutions: db.prepare(
    `SELECT * FROM tool_executions ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ),
  insertCost: db.prepare(
    `INSERT INTO cost_ledger (sessionId, model, tokensIn, tokensOut, costUsd) VALUES (?, ?, ?, ?, ?)`
  ),
  getTodayCost: db.prepare(
    `SELECT SUM(costUsd) as total FROM cost_ledger WHERE timestamp >= ?`
  ),
  getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  setSetting: db.prepare(
    `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = unixepoch()`
  ),
  getAllSettings: db.prepare(`SELECT * FROM settings`),
};

export function createSession(id: string, userId: string, channel: string, title?: string, model?: string): void {
  v2Stmts.createSession.run(id, userId, channel, title ?? null, model ?? null);
}

export function getSession(id: string) {
  return v2Stmts.getSession.get(id) as Record<string, unknown> | undefined;
}

export function listSessions(userId: string, limit = 50) {
  return v2Stmts.listSessions.all(userId, limit) as Record<string, unknown>[];
}

export function listAllSessions(limit = 50, offset = 0) {
  return v2Stmts.listAllSessions.all(limit, offset) as Record<string, unknown>[];
}

export function updateSessionCost(sessionId: string, tokensIn: number, tokensOut: number, costUsd: number): void {
  v2Stmts.updateSessionCost.run(tokensIn, tokensOut, costUsd, sessionId);
}

export function updateSessionTitle(sessionId: string, title: string): void {
  v2Stmts.updateSessionTitle.run(title, sessionId);
}

export function archiveSession(sessionId: string): void {
  v2Stmts.archiveSession.run(sessionId);
}

export function insertSessionMessage(sessionId: string, role: string, content: string, metadata?: Record<string, unknown>): number {
  const result = v2Stmts.insertSessionMessage.run(sessionId, role, content, metadata ? JSON.stringify(metadata) : null);
  return Number(result.lastInsertRowid);
}

export function getSessionMessages(sessionId: string) {
  return v2Stmts.getSessionMessages.all(sessionId) as Record<string, unknown>[];
}

export function logToolExecution(
  sessionId: string | null,
  toolName: string,
  input: Record<string, unknown> | null,
  output: string | null,
  durationMs: number | null,
  status: 'success' | 'error',
  error?: string
): void {
  v2Stmts.logToolExecution.run(
    sessionId, toolName,
    input ? JSON.stringify(input) : null,
    output ? output.slice(0, 5000) : null,
    durationMs, status, error ?? null
  );
}

export function getToolExecutions(limit = 50, offset = 0) {
  return v2Stmts.getToolExecutions.all(limit, offset) as Record<string, unknown>[];
}

export function insertCost(sessionId: string | null, model: string, tokensIn: number, tokensOut: number, costUsd: number): void {
  v2Stmts.insertCost.run(sessionId, model, tokensIn, tokensOut, costUsd);
}

export function getTodayCost(): number {
  const startOfDay = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);
  const result = v2Stmts.getTodayCost.get(startOfDay) as { total: number | null } | undefined;
  return result?.total ?? 0;
}

export function getSetting(key: string): string | undefined {
  const result = v2Stmts.getSetting.get(key) as { value: string } | undefined;
  return result?.value;
}

export function setSetting(key: string, value: string): void {
  v2Stmts.setSetting.run(key, value);
}

export function getAllSettings() {
  return v2Stmts.getAllSettings.all() as { key: string; value: string; updatedAt: number }[];
}

export { db as database };
