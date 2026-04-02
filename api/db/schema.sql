CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  name TEXT DEFAULT 'Default',
  tier TEXT DEFAULT 'free',
  monthly_limit INTEGER DEFAULT 100,
  rate_limit INTEGER DEFAULT 10,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id TEXT NOT NULL,
  month TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(api_key_id, month)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key_id TEXT,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  dodo_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
