# GakuPres Backend

MongoDB + Express.js backend for the GakuPres attendance system.

---

## How to Set Up

### 1. Install Node.js
Download and install Node.js **20 or newer** from https://nodejs.org (choose LTS version).

### 2. Install dependencies
Open a terminal inside this folder and run:
```
npm install
```

### 3. Set up your .env file
Copy the example file:
```
cp .env.example .env
```
Then open `.env` and fill in your values:
- **MONGO_URI** — your MongoDB Atlas connection string
- **JWT_SECRET** — 32+ random characters. Make one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- **PORT** — leave as 5000
- **LATE_AFTER_MINUTES** — minutes after class start that still count as Present (default 15)
- **SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM** — the email account that sends "forgot password" codes and receives feedback (see the notes in .env.example). Empty = emails are printed in the terminal (testing only)
- **FEEDBACK_TO** (optional) — where feedback from the app is emailed. Empty = `SMTP_USER`
- **TRUST_PROXY** — only if the server runs behind a proxy/host like Render or nginx: set to `1` so login rate limits see real IPs

### 4. Run the tests (optional)
```
npm test
```
Starts the server against a throwaway in-memory database (your real data is never touched) and checks every route.
The first run downloads a test MongoDB (~600 MB, once).

### 5. Run the server
```
npm run dev
```
You should see:
```
Connected to MongoDB
Server running on port 5000
```
If `MONGO_URI` or `JWT_SECRET` is missing, the server stops right away and says which one.

---

## API Endpoints

All routes except register, login, forgot and reset need the header `Authorization: Bearer <token>`.
A teacher can only see and change **their own** classes, students and attendance (anything else answers 404).
Sign-up always makes a teacher (Educator) account. Older accounts with the **Student** type get `403 NOT_EDUCATOR` on class routes.

### Server checks
| Method | URL | What it does |
|--------|-----|--------------|
| GET | / | `{ message: "GakuPres Backend is running." }` |
| GET | /health | `{ ok: true }` when the database is connected, `503` when not (used by the host) |
Errors always come back as `{ "message": "...", "code": "..." }` (`code` only when the app needs to react to it).

### Auth
| Method | URL | Body | What it does |
|--------|-----|------|--------------|
| POST | /api/auth/register | `{ full_name, email, password }` | Create a teacher account and email a 6-digit code, returns `{ token, user }` with `email_verified: false` |
| POST | /api/auth/login | `{ email, password, remember }` | Login, returns `{ token, user }` (30-day token with `remember`, else 7) |
| GET | /api/auth/me | - | The logged-in user |
| PATCH | /api/auth/me | `{ full_name, bio, avatar }` | Update profile. `avatar` = `data:image/jpeg;base64,...` (or png) that really is a JPEG/PNG, or null. The app sends 256x256 JPEGs |
| DELETE | /api/auth/me | `{ password }` | Delete the account and all of its classes, students, attendance and feedback |
| POST | /api/auth/forgot | `{ email }` | Email a 6-digit reset code (same answer whether or not the email exists) |
| POST | /api/auth/reset | `{ email, code, password }` | Set a new password with the code -> `{ token, user }`; all older logins stop working (also verifies the email) |
| POST | /api/auth/verify | `{ code }` | Enter the code from the sign-up email -> `{ user }` with `email_verified: true` |
| POST | /api/auth/verify/resend | - | A new code (15 seconds between codes) |
| POST | /api/auth/verify/email | `{ email }` | Typo in the email: change it and send a new code there (only before verifying) |

Until the email is verified, class and feedback routes answer `403 EMAIL_NOT_VERIFIED`. Accounts made before
verification existed (no `email_verified` value) count as verified.

### Feedback
| Method | URL | Body | What it does |
|--------|-----|------|--------------|
| POST | /api/feedback | `{ kind: "Bug" \| "Idea" \| "Other", message, app_version, platform }` | Saves it and emails it to `FEEDBACK_TO` with the teacher's name and email. Message 5-1000 characters, 5 per teacher per hour |

### Classes (what the app uses)
Every reply that contains a class includes that day's roster, `students: [{ _id, full_name, student_id, department, course, status, conflict }]`,
and `session: { date, start_time, adjusted, late_after, closed, closed_time, reopened }` for that day.
The class's `start_time` / `end_time` in a reply are **that day's** times (a class with `times` has a different time per weekday);
`times` lists them all (empty = same time every day). Present/Late, auto-close, "Start attendance" and the proxy warning all use that day's times.

| Method | URL | Body | What it does |
|--------|-----|------|--------------|
| POST | /api/classes | `{ course, code, section, days, start_time, end_time, late_after?, times? }` | Create a class (`days` = array or "Monday,Wednesday", times "13:00", `late_after` minutes, default 15). `times` = "non-uniform time": `[{ day, start_time, end_time }]` for every picked day; `start_time` / `end_time` may then be left out |
| GET | /api/classes | - | All classes of the teacher, pinned first |
| GET | /api/classes/:id | - | One class |
| DELETE | /api/classes/:id | - | Delete a class **and its students and attendance** |
| PATCH | /api/classes/:id/pin | `{ pinned }` | Pin / unpin |
| POST | /api/classes/:id/students | `{ full_name, student_id, department, course }` | Add a student |
| PATCH | /api/classes/:id/students/:sid | `{ status, date? }` | Set the status for today, or for a past `date` (correcting the record) |
| DELETE | /api/classes/:id/students/:sid | - | Remove a student |
| POST | /api/classes/:id/scan | `{ student_id, add, full_name, department, course }` | Mark a scanned student (see below) |
| POST | /api/classes/:id/start | - | "Start attendance" now: today's start time becomes now (teacher running late). End time stays |
| DELETE | /api/classes/:id/start | - | Back to the scheduled start time for today |
| POST | /api/classes/:id/close | - | Stop scanning for today (unscanned students stay Absent) |
| POST | /api/classes/:id/reopen | - | Allow scanning again, also after the end time |
| PATCH | /api/classes/:id | `{ late_after }` and/or `{ course, code, section, days, start_time, end_time, times }` | Minutes after the start that still count as Present (0-120). Sending any class field = Edit class: all of them are replaced, with the same checks as create. Attendance already taken stays |
| GET | /api/classes/:id?date=YYYY-MM-DD | - | A past day's roster, read only (`status: null` = no record that day) |
| GET | /api/classes/:id/attendance?from=&to= | - | History: every day with attendance + each student's status per day (default last 30 days, max 366) |
| POST | /api/classes/:id/students/import | `{ students: [...] }` | Add many students; bad rows and existing IDs are skipped -> `{ added, skipped, class }` |

The old `/api/students` and `/api/attendance` routes were removed: everything goes through `/api/classes` above,
so there is one place to secure. (The unauthenticated `POST /api/attendance/scan` with the `GAKU-...` code is gone too.)

---

## How QR Scanning Works
1. The QR printed on each student ID holds: **ID number, name, department, course, date of birth**.
2. The app reads it and sends `POST /api/classes/:id/scan { student_id, full_name, department, course }`.
   The date of birth is never sent.
3. The backend looks for that `student_id` **in that class**:
   - found → marked **Present** if it's on time or within `LATE_AFTER_MINUTES` (15) after `start_time`, otherwise **Late**.
     Already Present/Late today → nothing changes, reply has `already: true`.
   - not found → `404` with `code: "NOT_IN_CLASS"`. The app asks "Student not in class, add them?" and, on Add,
     sends the same request with `add: true`: the student is created and marked in one go.
4. Reply: `{ student, already, class }`.

**Days and time zones:** attendance is stored per class **per day** (one session per day, one record per student).
The app sends its own date and time in the `X-Local-Date` (`2026-10-08`) and `X-Local-Time` (`13:05`) headers, so
"today" and Present/Late follow the teacher's phone even if the server runs in another time zone.
Without those headers the server's own clock is used.

**Closing:** scanning closes automatically at the class `end_time`, or earlier with `POST /close`; `POST /reopen`
opens it again. Scans while closed get `409 ATTENDANCE_CLOSED`.

**Offline scans:** the app saves scans on the phone when it can't reach the server and sends them later with
`at: { date, time }` = when the scan really happened. Present / Late and "closed" are decided by that time.
At most 7 days old (`SCAN_TOO_OLD`), never in the future.

**Proxy-scan warning:** if the same school ID was already scanned the same day in **another** class whose time
overlaps this one, both records get `conflict: { time, same_teacher, other_label }` and both teachers see a warning.
`other_label` (the other class's name) is only filled in when it's the same teacher; otherwise only the time is shared.

**Running late:** `POST /api/classes/:id/start` stores today's start time (`start_time` on the session) as the
current time. Present / Late is then counted from it; the class's end time never moves. Every class reply has
`session: { date, start_time, adjusted, late_after }`.

---

## Security
- Passwords hashed with bcrypt. Login answers the same way (and takes the same time) for a wrong email or a wrong password.
- Login: max 10 tries per 15 min per IP; sign-up: 10 per hour per IP (`middleware/rateLimit.js`). Answers `429`.
- Tokens are HS256 only (`alg: none` and other tricks are rejected), hold only the user id and a login version, last
  7 days (30 with "remember me"), and stop working if the account is deleted or the password is changed.
- Email verification at sign-up: same kind of code as below (hashed, 15 minutes, 5 tries, 15 seconds between codes).
  Nothing works until it's entered. A sign-up that is never verified frees its email after 24 hours, so nobody can
  block someone else's email by signing up with it. If email can't be sent, sign-up is refused (503) instead of
  making an account that could never be verified.
- Forgot password: the 6-digit code is stored only as a hash, works for 15 minutes and allows 5 tries; asking for a
  code gives the same answer whether or not the email has an account. Limits: 5 code requests per hour, 10 resets per 15 min per IP.
- Deleting an account needs the password and removes all of its classes, students and attendance (5 tries per 15 min).
- Profile pictures must really be JPEG/PNG files (the file signature is checked, not just the label); SVG and anything else is refused.
- Limits so one account cannot fill the database: 100 classes per teacher, 1000 students per class. Names and other text
  have hidden control characters and invisible direction marks replaced by spaces.
- Tests (`npm test`) never send real email, even when `.env` has Gmail set up.
- Every class / student / record is checked to belong to the logged-in teacher; sign-up can't pick `Admin`.
- All input is type-checked and length-limited (no MongoDB operator injection like `{ "$gt": "" }`).
- The phone's date is only accepted within a day of the real date.
- No `X-Powered-By` header; `nosniff`, `DENY` framing, `no-store` caching on every reply; errors never include stack traces.
- The server warns if `JWT_SECRET` is shorter than 32 characters (and refuses to start with `NODE_ENV=production`).
- **Before going live:** serve over **https** (Render does this, see `DEPLOY.md`), use a long random `JWT_SECRET`,
  give the MongoDB Atlas user a strong password (Render has no fixed IP, so Atlas has to allow `0.0.0.0/0`), and run
  `npm audit --registry=https://registry.npmjs.org` now and then.

---

## Folder Structure
```
backend/
├── lib/
│   ├── attendance.js     shared logic: ownership, rosters, Present/Late, scan, proxy warning, history, import
│   ├── mail.js           sends emails: reset codes, feedback (SMTP settings in .env)
│   └── log.js            timestamped log lines
├── models/
│   ├── User.js
│   ├── Class.js
│   ├── Student.js
│   ├── AttendanceSession.js
│   ├── AttendanceRecord.js
│   └── Feedback.js       messages from the app's Feedback screen
├── routes/
│   ├── auth.js           sign up, log in, profile, forgot password, delete account
│   ├── classes.js        classes, students, attendance, scan, history
│   └── feedback.js       POST /api/feedback
├── middleware/
│   ├── auth.js           login check + account type check
│   └── rateLimit.js      login / sign-up attempt limits
├── test/
│   └── api.test.js       npm test: checks every route on a throwaway database
├── .env.example          copy to .env and fill in (never commit .env)
├── DEPLOY.md             putting the server online (Render)
├── package.json
├── README.md
└── server.js             starts everything: security headers, logging, routes, errors, database
```
`render.yaml` (the hosting setup) sits at the top of the repo, next to the `app/` and `backend/` folders.
