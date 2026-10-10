# Putting the GakuPres server online (free)

Goal: the server runs on the internet with **https**, so the app works on any phone, on any network, for free.
It uses **Render** (server, free plan), **MongoDB Atlas** (database, free), **Brevo** (email, free, 300 a day) and
**cron-job.org** (keeps the free server awake, free). The code is in the team's GitHub repo
(**Aimss-gh/GakuPres**), with this server in the `backend/` folder. `render.yaml` at the top of the repo tells Render that.

Why Brevo: Render's free plan blocks the ports Gmail uses for sending, so the sign-up and reset codes are sent
through Brevo's web API instead. (On your own computer, Gmail in `.env` still works.)

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

## 3. Brevo (email)
1. Sign up at brevo.com (free plan).
2. **Senders, Domains & Dedicated IPs > Senders > Add a sender**: name `GakuPres`, email `gakupres@gmail.com`.
   Brevo emails that address a code: open gakupres@gmail.com and confirm.
3. **SMTP & API > API keys > Generate a new API key**. Copy it: that's `BREVO_API_KEY` (shown only once).
   Brevo may ask to activate the free transactional email service first; follow its steps.
4. Codes sent from a gmail.com address through Brevo can land in **spam** at first. Tell teachers to check spam
   (the app's "Check your email" screen already says so).

## 4. Render
1. Sign up at render.com with the GitHub account that can see the repo.
2. **New > Blueprint** -> pick **Aimss-gh/GakuPres** -> branch `main`.
   Render reads `render.yaml` (free plan, builds only the `backend/` folder) and asks for the secret values:
   - `MONGO_URI` - from step 2
   - `JWT_SECRET` - from step 1
   - `BREVO_API_KEY` - from step 3
   - `MAIL_FROM` - `GakuPres <gakupres@gmail.com>` (the sender you verified in step 3)
   - `FEEDBACK_TO` - `gakupres@gmail.com`
3. When it says **Live**, open `https://<your-service>.onrender.com/health`. It must show `{"ok":true}`.

## 5. Keep it awake (free)
The free plan sleeps after 15 minutes without use; waking up takes about a minute (the app waits for it, but it's slow).
1. Sign up at cron-job.org (free).
2. **Create cronjob**: URL `https://<your-service>.onrender.com/health`, every **10 minutes**, save.
One server awake all month uses about 744 of Render's 750 free hours, so this fits. (Turn the job off during long breaks
if you like; the server then just sleeps.)

## 6. Point the app at it
In `app/eas.json`, replace every `https://CHANGE-ME.example.com/api` with `https://<your-service>.onrender.com/api`.

## 7. Every time you change the server
Upload/push the change to `main`. Render redeploys by itself. Run `npm test` in `backend/` first.

## Logs
Render > your service > **Logs**. Every request is one line (time, method, path, status, duration).
Lines with `ERROR` are crashes, with the details underneath (for example "Brevo refused the email").
