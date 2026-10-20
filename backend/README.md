# OMNIX Backend — Node.js + WebSocket + Postgres

Фиолетовый бэкенд для мессенджера OMNIX. Работает в двух режимах: **Postgres** (прод) и **JSON fallback** (демо без БД).

## Быстрый старт (демо без Postgres)
```bash
cd backend
npm install
npm start
# frontend на http://localhost:3001/
# WS на ws://localhost:3001
```

## С Postgres
```bash
createdb omnix
psql omnix < schema.sql
cp .env.example .env
# пропиши DATABASE_URL
npm start
```

## API
- `GET /api/health` — статус
- `GET /api/chats` — список чатов
- `GET /api/messages/:chatId` — сообщения чата
- `POST /api/messages` — `{chatId, senderId, body:{text, replyTo, poll}}`

## WebSocket события
Клиент подключается к `ws://localhost:3001` и шлёт JSON:

```js
ws.send(JSON.stringify({type:'hello', me:{name, color}}))
ws.send(JSON.stringify({type:'message', chatId:'alex', message:{id,text,time}}))
ws.send(JSON.stringify({type:'typing', chatId:'alex', typing:true}))
// WebRTC signaling для P2P звонков:
ws.send(JSON.stringify({type:'webrtc-offer', sdp}))
```

Сервер ретранслирует всем кроме отправителя — готово для P2P.

## Структура
- `server.js` — Express + WS, CORS, статика фронта
- `schema.sql` — таблицы users/chats/members/messages
- `db.json` — fallback хранилище (создаётся автоматом)

## Деплой
`Dockerfile` можно добавить так:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci
COPY . .
EXPOSE 3001
CMD ["node","backend/server.js"]
```
