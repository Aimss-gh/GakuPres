# Putting the GakuPres server online

Goal: the server runs on the internet with **https**, so the app works on any phone, on any network.
This uses **Render** (render.com), which gives https automatically. The code lives in the team's GitHub repo
(**Privvy**), with this server in the `backend/` folder. `render.yaml` at the top of the repo tells Render that.

---

## 1. Make a strong JWT secret
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the long text it prints. You'll paste it into Render as `JWT_SECRET`. (Everyone logs in again after it changes.)

## 2. MongoDB Atlas
1. **Network Access:** add `0.0.0.0/0` (allow from anywhere). Render has no fixed address, so the strong
   database password is what protects the database.
2. **Backups:** the free cluster (M0) has none. Export attendance from the app regularly (History > Export).
3. Have the connection link ready (Connect > Drivers). That's `MONGO_URI`.

## 3. Render
1. Sign up at render.com with your GitHub account.
2. **New > Blueprint** -> pick the **Privvy** repository -> branch `main`.
   Render reads `render.yaml` (it builds only the `backend/` folder) and asks for the secret values:
   - `MONGO_URI` - from step 2
   - `JWT_SECRET` - from step 1
   - `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` - the Gmail account that sends "forgot password" codes
3. Plan: **Starter** is recommended. The free plan sleeps after 15 minutes without use, and the first
   request after that takes about a minute.
4. When it says **Live**, open `https://<your-service>.onrender.com/health`. It must show `{"ok":true}`.

## 4. Point the app at it
In `app/eas.json`, replace every `https://CHANGE-ME.example.com/api` with `https://<your-service>.onrender.com/api`.

## 5. Every time you change the server
Commit and push to `main`. Render redeploys by itself. Run `npm test` in `backend/` before pushing.

## Logs
Render > your service > **Logs**. Every request is one line (time, method, path, status, duration).
Lines with `ERROR` are crashes, with the details underneath.
