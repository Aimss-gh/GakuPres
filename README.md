# GakuPres

Attendance app for teachers: scan the QR code on a student's ID to mark them Present or Late.

| Folder | What it is | Start here |
|---|---|---|
| `app/` | The mobile app (React Native + Expo) | `app/README.md` |
| `backend/` | The server (Node.js + Express + MongoDB) | `backend/README.md` |

## Run it on your computer
1. Server: `cd backend`, copy `.env.example` to `.env` and fill it in, then `npm install` and `npm run dev`.
2. App: `cd app`, copy `.env.example` to `.env`, then `npm install` and `npx expo start -c`. Scan the QR with Expo Go.

## Tests
`npm test` in `app/` and in `backend/`.

## Put it online
`backend/DEPLOY.md` (the server) and "Going live" in `app/README.md` (the app). `render.yaml` here is the hosting setup.
