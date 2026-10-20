import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || '';

// ---- DB abstraction: Postgres or JSON fallback ----
let pgPool = null;
let usePG = false;
if (DATABASE_URL) {
  try {
    const { Pool } = await import('pg');
    pgPool = new Pool({ connectionString: DATABASE_URL });
    await pgPool.query('SELECT 1');
    usePG = true;
    console.log('✅ Postgres connected');
  } catch (e) {
    console.log('⚠️ Postgres not available, fallback to JSON:', e.message);
    usePG = false;
  }
} else {
  console.log('ℹ️ DATABASE_URL empty → JSON fallback (backend/db.json)');
}

// JSON fallback store
const DB_FILE = path.join(__dirname, 'db.json');
function loadJSON() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users: [], chats: [], messages: [] }; }
}
function saveJSON(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
if (!fs.existsSync(DB_FILE) && !usePG) saveJSON({ users: [{ id: 'me', name: 'Вы', color: '#7c3aed' }], chats: [], messages: [] });

async function dbQuery(text, params) {
  if (usePG) return pgPool.query(text, params);
  // fallback: emulate tiny subset
  return { rows: [] };
}

// ---- Express ----
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..'))); // serve frontend

app.get('/api/health', (req, res) => res.json({ ok: true, pg: usePG, uptime: process.uptime() }));

app.get('/api/chats', async (req, res) => {
  if (usePG) {
    const { rows } = await dbQuery('SELECT * FROM chats ORDER BY created_at DESC');
    return res.json(rows);
  }
  const data = loadJSON();
  res.json(data.chats);
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  if (usePG) {
    const { rows } = await dbQuery('SELECT * FROM messages WHERE chat_id=$1 ORDER BY created_at ASC', [chatId]);
    return res.json(rows);
  }
  const data = loadJSON();
  res.json(data.messages.filter(m => m.chat_id === chatId));
});

app.post('/api/messages', async (req, res) => {
  const { chatId, senderId, body } = req.body;
  const id = Math.random().toString(36).slice(2, 9);
  if (usePG) {
    await dbQuery('INSERT INTO messages (id, chat_id, sender_id, body) VALUES ($1,$2,$3,$4)', [id, chatId, senderId, body]);
  } else {
    const data = loadJSON();
    data.messages.push({ id, chat_id: chatId, sender_id: senderId, body, created_at: new Date().toISOString() });
    saveJSON(data);
  }
  // broadcast via WS
  broadcast({ type: 'message', chatId, message: { id, chatId, ...body, time: new Date().toLocaleTimeString().slice(0,5) } });
  res.json({ ok: true, id });
});

// ---- WebSocket (signaling + realtime) ----
const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();
function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(data);
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WS client connected, total', clients.size);
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'hello') {
        ws.me = msg.me;
        ws.send(JSON.stringify({ type: 'welcome', me: msg.me, time: new Date().toISOString() }));
      }
      if (msg.type === 'message') {
        // relay to others (simple P2P signaling mock)
        for (const c of clients) if (c !== ws && c.readyState === 1) c.send(JSON.stringify(msg));
      }
      if (msg.type === 'typing') {
        for (const c of clients) if (c !== ws && c.readyState === 1) c.send(JSON.stringify(msg));
      }
      if (msg.type === 'webrtc-offer' || msg.type === 'webrtc-answer' || msg.type === 'webrtc-ice') {
        for (const c of clients) if (c !== ws) c.send(JSON.stringify(msg));
      }
    } catch {}
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n💜 OMNIX backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}/`);
  console.log(`   WS: ws://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  if (!usePG) console.log('   DB: JSON fallback at backend/db.json (set DATABASE_URL to use Postgres)');
});
