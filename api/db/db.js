import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'tangentflow.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
db.exec(schema)

// ── API Keys ──
export function createApiKey(userId, email, tier = 'free') {
  const id = 'tf_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  const limits = { free: 100, starter: 1000, growth: 10000, scale: 100000 }
  const rates = { free: 10, starter: 60, growth: 120, scale: 300 }

  db.prepare(`INSERT INTO api_keys (id, user_id, email, tier, monthly_limit, rate_limit)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, email, tier, limits[tier] || 100, rates[tier] || 10)

  return { id, tier, monthlyLimit: limits[tier] || 100 }
}

export function getApiKey(keyId) {
  return db.prepare('SELECT * FROM api_keys WHERE id = ? AND is_active = 1').get(keyId)
}

export function updateKeyTier(keyId, tier) {
  const limits = { free: 100, starter: 1000, growth: 10000, scale: 100000 }
  const rates = { free: 10, starter: 60, growth: 120, scale: 300 }
  db.prepare('UPDATE api_keys SET tier = ?, monthly_limit = ?, rate_limit = ? WHERE id = ?')
    .run(tier, limits[tier] || 100, rates[tier] || 10, keyId)
}

export function deactivateKey(keyId) {
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(keyId)
}

export function touchKey(keyId) {
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyId)
}

export function getKeysByUser(userId) {
  return db.prepare('SELECT id, name, tier, monthly_limit, is_active, created_at FROM api_keys WHERE user_id = ?').all(userId)
}

// ── Usage ──
export function getUsage(keyId, month) {
  const row = db.prepare('SELECT count FROM usage WHERE api_key_id = ? AND month = ?').get(keyId, month)
  return row ? row.count : 0
}

export function incrementUsage(keyId) {
  const month = new Date().toISOString().slice(0, 7) // '2026-04'
  db.prepare(`INSERT INTO usage (api_key_id, month, count) VALUES (?, ?, 1)
    ON CONFLICT(api_key_id, month) DO UPDATE SET count = count + 1`).run(keyId, month)
  return getUsage(keyId, month)
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

// ── Subscriptions ──
export function upsertSubscription(id, userId, tier, status, apiKeyId, dodoData) {
  db.prepare(`INSERT INTO subscriptions (id, user_id, api_key_id, tier, status, dodo_data)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET tier = ?, status = ?, dodo_data = ?`)
    .run(id, userId, apiKeyId, tier, status, JSON.stringify(dodoData), tier, status, JSON.stringify(dodoData))
}

export default db
