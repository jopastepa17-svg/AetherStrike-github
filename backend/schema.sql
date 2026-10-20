-- OMNIX Postgres schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  pubkey TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('private','group','channel')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id),
  type TEXT DEFAULT 'text',
  body JSONB NOT NULL, -- {text, fname, fsize, src, poll, replyTo}
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON messages(chat_id, created_at);

-- seed demo
INSERT INTO users (id, name, color) VALUES ('me','Вы','#7c3aed') ON CONFLICT DO NOTHING;
INSERT INTO chats (id, title, type) VALUES ('alex','Алексей','private'),('project','Проект Omnix','group') ON CONFLICT DO NOTHING;
