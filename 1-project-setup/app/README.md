# GakuPres - teacher attendance app (React Native + Expo SDK 57)

The teacher makes classes, then **scans the QR code on each student's ID**. Students are marked Present or Late
automatically, and students who aren't in the class yet can be added straight from the scan.

- Built for **Expo SDK 57** = the **latest Expo Go** on the stores today (expo.dev/go lists "SDK 57 (latest)").
- Works with the real server in `../backend` (Node.js + Express + MongoDB), or **without it** on fake data saved
  in the phone (handy for trying things out). Only the `src/api/` folder ever touches the backend.

---

## 1. Run it

1. Install **Node.js 22.13 or newer** (nodejs.org). Check: `node -v`
2. Install **Expo Go** on your phone (Play Store / App Store) and update it to the newest version.
3. Phone and computer on the **same wifi**.
4. In a terminal inside this folder:
   ```
   npm install
   npx expo install --fix      # IMPORTANT: locks every library to the exact versions Expo Go ships
   npx expo start
   ```
5. Scan the QR in the terminal. **Android:** Expo Go -> Scan QR code. **iPhone:** normal Camera app.
6. Fake-data mode: log in with **any email + any password of 8+ characters**. Real server: section 5.
7. `npm test` checks the app's logic (QR reader, CSV/Excel files, dates, offline scans, fake-data mode) without a phone.

> Expo Go contains fixed native versions of each library. If a package version doesn't match, the app can crash
> on start. `npx expo install --fix` (or `npx expo-doctor` to just check) fixes that. Run it any time something
> acts weird after installing a package.

Fake data lives in the phone's storage. To start clean, log out and register a new email.
Simulators have no camera, so the scanner screen has a **"Simulate scan (dev only)"** button in fake mode.

---

## 2. Where do I change fonts, images and texts?  (the "I'm dizzy" map)

Everything you'd want to edit lives in **4 files**. You almost never need to open a screen file.

| I want to change... | Open this file | Notes |
|---|---|---|
| **Any word on screen** | `src/content.js` | grouped by page: `T.login`, `T.forgot`, `T.register`, `T.verify`, `T.dashboard`, `T.createClass`, `T.classDetail`, `T.importList`, `T.history`, `T.scan`, `T.settings`, `T.feedback` |
| **Any image / logo** | `src/assets.js` (+ the files in `/assets`) | `IMG.loginLogo`, `IMG.headerLogo`, `IMG.emptyState`, `IMG.authBackground` |
| **Fonts, text sizes, colors** | `src/theme.js` | `F` = fonts, `FS` = sizes, `C` = colors |
| **Switches** (password minimum, scan timing, late-after choices, ID masking, privacy link, day/status names) | `src/constants.js` | |

### 2.1 Page by page

For each page: the file that draws it, then **what to edit for each thing you see**.
`T.x.y` = key `y` inside section `x` of `src/content.js`. `FS.x` / `F.x` / `C.x` = tokens in `src/theme.js`.

#### Login  -  `src/screens/Login.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Cap picture next to the logo | - | `IMG.loginLogo` -> `assets/icon.png` (size is `S.logo` in Login.js, 1.5x the GAKUPRES text) | - |
| "GAKUPRES" next to it | `T.brand.a` + `T.brand.b` | - | `F.pixel` (Pixelify Sans), `FS.script` (34, same as "Welcome") |
| "Welcome" | `T.login.title` | - | `F.script`, `FS.script` (34) |
| "Sign in to your account..." | `T.login.subtitle` | - | `FS.sm` (11) |
| Field labels (Email address / Password) | `T.login.email`, `T.login.password` | - | `F.semi`, `FS.xs` (10) - drawn by `components/Field.js` |
| Placeholders | `T.login.emailPh`, `T.login.passwordPh` | - | `FS.md` (12) |
| Password hint (min 8) | `T.login.hint` (the number comes from `MIN_PASSWORD` in constants.js) | - | `FS.xs` |
| Remember me | `T.login.remember` | - | `FS.sm` |
| Login button | `T.login.button` / `T.login.busy` | - | `F.medium`, `FS.lg` (13) |
| "Forgot password?" link | `T.login.forgot` | - | `FS.sm` |
| Don't have an account? Sign up | `T.login.noAccount`, `T.login.signUp` | - | `FS.sm` |
| Red error messages | `T.login.errEmpty`, `T.login.errShort` | - | `FS.md` |
| Copyright line at the bottom | `T.footer` | - | `FS.xs` |
| Orange background | colors `C.orange2` -> `C.orange` (in `components/AuthShell.js`) | `IMG.authBackground` (null = gradient) | - |

#### Forgot password  -  `src/screens/ForgotPassword.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| "Reset password" + help line | `T.forgot.title`, `.emailHelp` | - | `F.script`, `FS.script` / `FS.sm` |
| Send code / code + new password fields | `T.forgot.send`, `.code`, `.newPassword`, `.save`, `.again`, `.back` | - | same as Login |
| Errors | `T.forgot.errEmail`, `.errCode` (+ the server's messages) | - | `FS.md` |

#### Register  -  `src/screens/Register.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| "Register" | `T.register.title` | - | `F.script`, `FS.script` (34) |
| Labels + placeholders | `T.register.name`, `.namePh`, `.email`, `.emailPh`, `.password`, `.passwordPh`, `.confirm` | - | `F.semi`, `FS.xs` / `FS.md` |
| "By signing up you agree to the Privacy Policy" | `T.register.agree`, `.privacy` (shown only when `PRIVACY_URL` is set) | - | `FS.sm` |
| Password hint | `T.register.hint` | - | `FS.xs` |
| Sign up button | `T.register.button` / `.busy` | - | `F.medium`, `FS.lg` |
| Already have an account? Login | `T.register.haveAccount`, `.login` | - | `FS.sm` |
| Errors | `T.register.errEmpty`, `.errShort`, `.errMatch` | - | `FS.md` |
| Background / footer | same as Login | `IMG.authBackground` | |

#### Check your email  -  `src/screens/VerifyEmail.js` (after sign-up, until the code is entered)
App.js shows only this screen while `user.verified === false`; the server keeps classes locked until then.
| What you see | Text | Image | Font / size |
|---|---|---|---|
| "Check your email" + "We sent a 6-digit code to ..." | `T.verify.title`, `.sentTo`, `.sentTo2` | - | `F.script` `FS.script` / `FS.sm` |
| Code box, Verify button | `T.verify.code`, `.verify`, `.checking`, `.errCode` | - | `FS.md` / `FS.lg` |
| "Send a new code" (15-second wait, counts down) | `T.verify.resend`, `.resendIn` | - | `FS.sm` |
| "Wrong email? Change it" -> new email box | `T.verify.wrong`, `.change`, `.newEmail`, `.sendHere`, `.waitBtn` | - | `FS.sm` / `FS.md` |
| Log out | `T.verify.logout` | - | `FS.sm` |
Fake-data mode: the code is always **123456**.

#### Dashboard (class list)  -  `src/screens/Dashboard.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Cap + GAKUPRES on the orange bar | `T.brand.a` + `T.brand.b` | `IMG.headerLogo` -> `assets/icon-dark.png` (null = text only). Size is `S.logoImg` in `components/Header.js` | `F.pixel` (Pixelify Sans), `FS.logo` (20) |
| Avatar menu: Feedback / Settings / Log Out | `T.dashboard.menu.*` (+ `T.dashboard.logoutTitle` / `.logoutBody` when scans are still waiting to upload) | your profile picture | `FS.md` |
| Class card title ("4ITPE3 - Section 1") | `T.dashboard.classTitle` | - | `F.medium`, `FS.lg` - drawn by `components/ClassCard.js` |
| Class card: course name + schedule (one line per day for a class with a different time each day) | (built from the class data) | - | course `FS.sm`, schedule `FS.xs` |
| Pin / Unpin | `T.dashboard.pin`, `.unpin` | - | `FS.md` |
| 3/5 number in the ring | (data) | - | grows with the ring and shrinks to fit (`components/Ring.js`) |
| "Add a class to get started" | `T.dashboard.empty` | `IMG.emptyState` (null = QR icon) | `FS.sm` |
| "Loading classes..." | `T.dashboard.loading` | - | `FS.base` |
| Orange **+** button (bottom right) | `T.dashboard.create` (what screen readers say) | - | - |

#### Create Class (and Edit Class)  -  `src/screens/CreateClass.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Title "Create Class" (centered, big back arrow) | `T.createClass.title` | - | `F.medium`, `FS.pageTitle` (26), white - `components/Header.js`. Arrow size = `size={26}` there |
| Field labels | `T.createClass.course`, `.code`, `.section`, `.days`, `.start`, `.end` | - | `FS.sm` (11) |
| Placeholders | `T.createClass.coursePh`, `.codePh`, `.sectionPh`, `.daysPh`, `.timePh` | - | `FS.md` |
| "Non-uniform time" checkbox (above the days) -> one Start/End row per picked day | `T.createClass.perDay`, `.perDayHint`, `.perDayPick`, `.errDayTime`, `.errDayOrder` | - | `FS.md` / `FS.sm`. The class page and cards then list each day on its own line |
| Day names in the dropdown | `DAYS` in `constants.js` (they are sent to the server, so keep in sync with it) | - | `FS.md` - `components/DaysPicker.js` |
| Time popup title | `T.createClass.startTitle`, `.endTitle` | - | `F.semi`, `FS.base` |
| Big time in the popup + the number lists (they loop: 12 -> 1, 59 -> 00) | - | - | preview `FS.pageTitle`, numbers `FS.banner` (22), am/pm `FS.base` - `components/TimeField.js` |
| Set / Cancel | `T.createClass.setTime`, `T.common.cancel` | - | `FS.md` |
| "Late after:" minute chips | `T.createClass.grace`, `.graceHint` (choices = `GRACE_CHOICES`) | - | `FS.md` - `components/GracePicker.js` |
| Done / Save button (in a slim bar fixed at the bottom; the form scrolls above it, and it hides while the keyboard is open) | `T.createClass.done` / `.save` / `.busy` | - | `FS.md` |
| Errors | `T.createClass.errEmpty`, `.errTime` | - | `FS.md` |

#### Class Detail (banner + student table)  -  `src/screens/ClassDetail.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Top: Edit / History / delete | `T.classDetail.edit`, `.history` | - | `FS.md`. Edit opens the Create Class form filled in (`EditClass` in App.js), titled `T.createClass.editTitle`, button `T.createClass.save` |
| Orange banner: course name | (the class data) | - | `F.bold`, `FS.banner` (22), white |
| Banner subtitle ("4ITPE3 - Section 1") | `T.dashboard.classTitle` | - | `FS.md` |
| Schedule + date lines | (built from data) | - | `FS.sm` |
| Table header (Name / I.D / Course / Status) | `T.classDetail.colName`, `.colId`, `.colCourse`, `.colStatus` | - | `FS.sm` |
| Table rows | (student data) | - | `FS.sm` - `components/StudentRow.js`. Status colors: `statusColor` in theme.js |
| Hold a name -> bubble with the full name, just above the finger | (student name), `T.classDetail.holdName` (screen-reader hint) | - | `FS.md` |
| Row menu: status list | `STATUSES` in `constants.js` (sent to the server) | - | `FS.md` |
| Row menu: Remove | `T.classDetail.remove` | - | `FS.md` |
| "No students yet." | `T.classDetail.noStudents` | - | `FS.base` |
| Delete popup | `T.classDetail.deleteTitle`, `.deleteBody`, `.delete`, `T.common.cancel` | - | title `F.semi` `FS.base`, body `FS.md` |
| Add-student popup | `T.classDetail.addTitle`, `.addName`, `.addId`, `.addDep`, `.addCourse`, `.add`, `.adding`, `.errFill`, `.errId` | - | labels `FS.sm` - `components/AddStudentModal.js` |
| Buttons above the QR button | 📄 = class list: tap and **Import** / **Export** pop out (`components/ImportModal.js`, texts `T.importList`, `T.classDetail.importBtn` / `.exportBtn`), 👤+ = add one student | - | - |
| Day picker ‹ › / History / attendance bar | `T.classDetail.today`, `.pastNote`, `.history`, `.lateAfter`, `.start`, `.close`, `.reopen`, `.graceTitle` (`components/AttendanceBar.js`) | - | `FS.sm` |
| ⚠ next to a name + the note above the table | `T.classDetail.proxyLegend` (proxy-scan warning) | - | `FS.sm` |
| "3 scans saved offline" / Upload now / No connection | `T.classDetail.pending`, `.uploadNow`, `.offline`, `.dropped` | - | `FS.sm` |
| History screen (`screens/History.js`) | `T.history` (ranges, counts, Export to Excel) | - | `FS.base` / `FS.sm` |

#### QR Scanner  -  `src/screens/QRScan.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| "Scan student ID" + class name at the top | `T.scan.title`, `T.dashboard.classTitle` | - | `F.semi`, `FS.scanTitle` (22) / `FS.md` |
| Orange pill "Attendance for: 10/08/2026" | `T.scan.date` (the date is today on the phone, MM/DD/YYYY) | - | `F.semi`, `FS.md` |
| "3/30 present" next to it | `T.scan.present` | - | `FS.md` |
| Hint under the box | `T.scan.hint`, `.checking` | - | `FS.md` |
| Result card at the bottom (name, ID, status chip) | `T.scan.already` | - | `FS.base` / `FS.sm`. Chip colors: `statusTint` in theme.js |
| "Wrong QR please try again" popup | `T.scan.wrongTitle`, `.wrongBody`, `.tryAgain` | - | `FS.base` / `FS.md` |
| "Student not in class, add them?" popup | `T.scan.notInClass`, `.idLbl`, `.deptLbl`, `.courseLbl`, `.add`, `.adding`, `T.common.cancel` | - | `FS.base` / `FS.md` |
| "Attendance is closed" box + Reopen | `T.scan.closedTitle`, `.closedBody`, `.reopen` | - | `FS.base` / `FS.sm` |
| "Saved offline" / "3 waiting to upload" / ⚠ also scanned elsewhere | `T.scan.savedOffline`, `.pending`, `.proxy` | - | `FS.sm` |
| Other errors popup | `T.scan.errTitle`, `.ok` | - | `FS.md` |

#### Settings  -  `src/screens/Settings.js`
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Title bar "Settings" with back arrow (same as Create Class / History / Feedback) | `T.settings.title` | - | `FS.pageTitle` - `components/Header.js` |
| Photo, name, bio, Save | `T.settings.photo`, `.name`, `.bio`, `.save`, `.saved` | your profile picture | `FS.base` / `FS.md` |
| Privacy policy link | `T.settings.privacy` (shown only when `PRIVACY_URL` is set) | - | `FS.md` |
| Delete account box + popup | `T.settings.danger`, `.dangerBody`, `.deleteTitle`, `.deleteBody`, `.deleteBtn` | - | `FS.base` / `FS.sm` |

#### Feedback  -  `src/screens/Feedback.js` (avatar menu > Feedback)
| What you see | Text | Image | Font / size |
|---|---|---|---|
| Title bar | `T.feedback.title` | - | `FS.pageTitle` |
| Help line, "What is it about?" chips (Something is wrong / An idea / Other) | `T.feedback.help`, `.kind`, `.kinds` | - | `FS.md` |
| Message box (1000 characters) + hint that changes with the chip | `T.feedback.message`, `.placeholder.*` | - | `FS.md` |
| Send button, "your name and email are sent" note, error | `T.feedback.send`, `.note`, `.errShort` | - | `FS.md` / `FS.xs` |
| Thank-you page | `T.feedback.thanks`, `.thanksBody`, `.back` | check icon | `FS.banner` |
| Done button | `T.scan.done` | - | `FS.md` |
| Camera permission screen | `T.scan.permText`, `.allow`, `.openSettings`, `.back`, `.camError` | - | `FS.base` |
| "Simulate scan (dev only)" | `T.scan.simulate` | - | `FS.md` |
| The OS camera-permission popup wording | `app.json` -> `plugins` -> `expo-camera` -> `cameraPermission` (needs a new build to change; Expo Go shows its own wording) | - | - |

### 2.2 How to replace things

**A text:** open `src/content.js`, find the page section, edit what's between the quotes, save. The app refreshes by itself.
If the text is a function like `(n) => \`Minimum of ${n} characters\``, keep the `${n}` part.

**An image:**
1. Make your image and **save it over the file in `/assets` with the same name** (nothing else to change), or put a new file there and point to it in `src/assets.js`.
2. Restart with `npx expo start -c` (the `-c` clears the cache).

| File / key | Where it shows | Suggested size |
|---|---|---|
| `assets/icon.png` (`IMG.loginLogo`) | Login card (and the app icon) | 1024x1024 PNG |
| `assets/icon-dark.png` (`IMG.headerLogo`) | Orange top bar, left of GAKUPRES | square PNG, transparent (shown about 32x32) |
| `IMG.emptyState` | Dashboard with no classes | about 480x480 PNG, transparent |
| `IMG.authBackground` | Login + Register background | about 1080x1920 |
| `assets/icon.png` | App icon (**only visible in a real build**, Expo Go uses its own) | 1024x1024 PNG, no transparency |
| `assets/adaptive-icon.png` | Android icon (background color is in `app.json`) | 1024x1024 PNG, transparent, keep the picture inside the middle 66% |

**A font (from Google Fonts):**
1. `npm i @expo-google-fonts/poppins` (any font package from `@expo-google-fonts/...`)
2. In `App.js`: `import { Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';` and add them to the `useFonts({ ... })` list.
3. In `src/theme.js`: `F.body = 'Poppins_400Regular'` (and the other slots).

**A font (your own .ttf file):** put it in `assets/fonts/MyFont.ttf`, then in `App.js` add `MyFont: require('./assets/fonts/MyFont.ttf')` inside `useFonts({ ... })` and set `F.body = 'MyFont'`.

React Native has no `fontWeight` for custom fonts - for "bolder text" pick a different slot in `F` (for example `F.bold`).

**A size or color:** change the number/hex in `FS` / `C` in `src/theme.js`. Everything using it updates.

### 2.3 Text sizes (`FS` in theme.js)
| Token | px | Used for |
|---|---|---|
| `xs` | 10 | field labels, password hint, class-card schedule, footer |
| `sm` | 11 | student table, subtitles, links, form labels, date/time line |
| `md` | 12 | input text, menu items, errors, small buttons, banner subtitle, popup text, day names |
| `lg` | 13 | big buttons, class card title |
| `base` | 14 | default text, popup titles |
| `logo` | 20 | GAKUPRES on the orange bar |
| `brand` | 20 | (not used any more; the Login GAKUPRES uses `script`) |
| `banner` | 22 | course name on the banner, numbers in the time popup |
| `pageTitle` | 26 | "Create Class", big time preview |
| `scanTitle` | 22 | "Scan student ID" |
| `script` | 34 | "Welcome", "Register" |

### 2.4 Things that are NOT in content.js (on purpose)
- **Day names** and **status names** (`DAYS`, `STATUSES` in constants.js) - the server stores them, so changing them means changing the server too.
- **Button accessibility labels** (what screen readers say, like "Delete class") - written inside each component.
- **Network error messages** - `src/api/http.js` ("Cannot reach the server...") and the fake-server errors in `classApi.js` / `authApi.js`. Your real server sends its own `{ "message": "..." }`.

---

## 3. What every file does

```
index.js            starts the app
App.js              loads fonts, screen navigation, "logged in? show the app : show login"
app.json            app name, app id, icon, splash screen, permissions
eas.json            settings for real app builds (server address goes here)
.env.example        copy to `.env` (section 5)
assets/             icon.png, adaptive-icon.png, icon-dark.png (header cap), icon-light.png
tests/run.mjs       npm test
PRIVACY.md          the privacy policy | TESTING.md   real-phone test checklist

src/
  content.js        ALL texts            <-- edit words here
  assets.js         image registry       <-- swap images here
  theme.js          fonts, sizes, colors <-- restyle here
  constants.js      switches + day/status names
  utils.js          time/day/date formatting, Present-or-Late rule, counting present students
  qr.js             reads the student ID QR (ID, name, department, course, DoB)
  hooks/useSubmit.js   shared "busy + error + try/catch" for form buttons

  screens/          one file = one screen: Login, ForgotPassword, Register, Dashboard, CreateClass, ClassDetail,
                    QRScan, History, Settings, Feedback, VerifyEmail
  csv.js            reads and writes class-list CSV files (import / export)
  xlsx.js           the Excel (.xlsx) attendance report: colors, widths, frozen header
  share.js          saves a file and opens the phone's share menu

  components/       reusable pieces
    Header, AuthShell, ClassCard, StudentRow, AddStudentModal, ImportModal, AttendanceBar (late / start / close),
    GracePicker, DaysPicker, TimeField, Popover (floating ⋮ menus), Dialog (popups), Field, Plain, Btn, Txt,
    Icon (SVG icons), Ring

  context/AuthContext.js   remembers who is logged in

  api/              <<< THE ONLY FOLDER THAT TALKS TO THE BACKEND >>>
    http.js           sends requests, adds the token + the phone's date/time, handles errors/timeouts
    adapter.js        renames fields between the app and the backend
    session.js        keeps the token in secure phone storage
    authApi.js        login / register / me / logout / forgot + reset password / delete account
    classApi.js       classes, students, import, pin, delete, scan, start/close, history
    offline.js        scans saved on the phone while offline, uploaded later
    mockDb.js         the FAKE database (delete when the backend is real)
```
Screens never call `fetch`. They call `createClass(...)`, `scanStudent(...)` etc. Each function in `api/` has a fake branch and a real branch.

---

## 4. The QR system

**What the QR on a student's ID must contain** (in this order): **ID number, name, department, course, date of birth**.
The date of birth is skipped - never used or saved. `src/qr.js` reads any of these layouts:

```
00001111|Juan Dela Cruz|CCS|BSIT|01/01/2001          <- separated by | ; , or tab
```
```
00001111                                              <- one value per line
Juan Dela Cruz
CCS
BSIT
01/01/2001
```
```
ID: 00001111                                          <- labelled (any order)
Name: Juan Dela Cruz
Department: CCS
Course: BSIT
Birthday: 01/01/2001
```
```
{"id":"00001111","name":"Juan Dela Cruz","department":"CCS","course":"BSIT","dob":"2001-01-01"}
```

**What happens on a scan**
1. On a class page, tap the **QR button**. The camera fills the screen with a box in the middle.
   The top shows **"Attendance for: MM/DD/YYYY"** (today) and how many are present.
2. Hold an ID's QR inside the box. It is read automatically - there is nothing to tap.
3. The app reads the ID number, name, department and course and sends them to `POST /api/classes/:id/scan`.
   - **Student is in the class:** marked **Present**, or **Late** if it is more than 15 minutes after the class start time.
     The phone vibrates and the result card shows the name and status. Scanning the same ID again only says
     "already marked".
   - **Student is not in the class:** popup **"Student not in class, add them?"** with the details from the QR.
     **Add** adds them to the class and marks them Present/Late right away. **Cancel** goes back to scanning.
   - **Not a student ID QR / unreadable:** popup **"Wrong QR please try again"**.
4. The same QR is ignored for 3 seconds (`SCAN_COOLDOWN_MS`) so an ID held in front of the camera doesn't repeat.
5. **Done** goes back; the class table reloads with the new statuses.

IDs are shown with their first 4 digits replaced by one `#` (`00001111` -> `#1111`) on the class table and the scanner.
Only the screen changes - the full ID is saved and matched. Change or turn off with `MASK_ID_DIGITS` in constants.js.
QRs whose ID already starts with `#` (like `####1111`) are accepted too, and also show as `#1111`.

## 4b. Day-to-day features

**Past days (class page).** Under the schedule: **‹ Thu, Oct 8, 2026 ›**. The arrows walk through earlier days,
**Today** jumps back. A past day shows that day's record (`—` = no record that day, e.g. the student was added later).
Tap ✎ to correct a status on that day. Scanning is only for today.

**History + export (class page -> History).** Every day attendance was taken in the last 7 days / this month /
30 days / 12 months, with present / late / excused / absent counts. Tap a day to open it.
**Export to Excel (.xlsx)** makes a real Excel workbook, then opens the phone's share menu (save to Files / Drive,
email, Messenger...). It opens in Excel and Google Sheets.
- Sheet **Attendance**: one row per student, one column per day with colored P / L / E / A (green / yellow / grey / red),
  the start time of each day ("late start" when Start attendance was used), and totals. The header and names stay
  on screen while you scroll.
- Sheet **Days**: one row per day with present / late / excused / absent counts.
- Full student IDs are in the file (only the screen hides digits), stored as text so leading zeros stay.
- Made on the phone (`src/xlsx.js`, zipped with the small `fflate` library), so it also works offline.

**Import / export the class list (class page -> 📄 button -> Import or Export).** Export saves the students as a `.csv` in the same columns, so it can be imported into another class (full IDs). Import: Pick a `.csv` file. Columns: **ID, Name, Department, Course**
(any order with a header row; *Last name / First name / M.I.* columns also work; without a header the order is
ID, Name, Department, Course). You see who will be added and which rows are skipped (missing data, bad ID, listed
twice) before importing. IDs already in the class are skipped. From Excel: *File > Save As > CSV*. Max 1000 students per file and per class / 1 MB. Hidden characters (tabs, line breaks, direction marks) become spaces.

**Close attendance.** Scanning closes by itself at the class **end time**. **Close attendance** closes it earlier;
**Reopen** opens it again (also after the end time). Students who weren't scanned stay **Absent** - everyone
starts Absent every day, so nothing else is needed. The scanner shows "Attendance is closed" with a Reopen button.

**Late after (per class).** Create Class has **Late after: 0 5 10 15 20 30** minutes (default 15). On the class page,
tap **Late after 1:15 pm** to change it.

**Offline scanning (real server only).** If the wifi drops while scanning, scans are **saved on the phone with the
time they happened** ("Saved offline" on the result card, "3 waiting to upload" at the top). They upload by themselves
when the scanner, class page or dashboard is open and the server answers, and Present / Late uses the real scan
time. The class must have been opened once that day with a connection (so the phone knows the student list).
Scans older than 7 days, or after attendance was closed, are refused by the server and you're told.
Logging out with scans not uploaded asks first.

**Running late? "Start attendance"**
The class page shows "Late after 1:15 pm" (start time + 15 min). If the teacher starts class late, they tap
**Start attendance now**: for **today only** the start time becomes *now*, so students count as Present for 15 minutes
from that moment. The **end time never changes**. **Use schedule** undoes it.
Opening the scanner after the late mark without having started asks **"Running late?"** -> *Start now* / *Keep schedule*.
It can't be started after the class's end time, and starting before the scheduled start keeps the schedule.

Attendance is saved **per day**: every day starts with everyone Absent, and earlier days are kept.
"Today" and the Present/Late time come from the **phone's** clock (it is sent with every request), so it works
even if the server runs in another time zone.

**Making QR images for test IDs:** any QR generator works. Put the text in one of the layouts above, for example
`00001111|Juan Dela Cruz|CCS|BSIT|01/01/2001`. With Node: `npm i qrcode`, then
`await QRCode.toFile('00001111.png', '00001111|Juan Dela Cruz|CCS|BSIT|01/01/2001')`.

**Honest limit:** a QR can be copied by photo/screenshot. Fine when the teacher watches the scan.

---

## 5. Hooking up the backend

The backend is the **`backend/`** folder next to this one (Express + MongoDB). Its README covers setting it up.

1. Start the server there: `npm run dev` (you should see `Connected to MongoDB` and `Server running on port 5000`).
2. Find your computer's wifi address: Windows `ipconfig`, Mac/Linux `ifconfig` (looks like `192.168.1.23`).
3. Copy `.env.example` to `.env` here and set:
   ```
   EXPO_PUBLIC_USE_MOCK=false
   EXPO_PUBLIC_API_URL=http://192.168.1.23:5000/api
   ```
   **Never `localhost`** - on a phone that means the phone itself.
4. Restart: `npx expo start -c` (`-c` makes it re-read `.env`).
5. Click through every screen. Errors show on screen; also watch the server terminal.

`src/api/adapter.js` is the only file that knows the backend's field names (`full_name`, `student_id`,
`department`, `start_time` ...). Screens always see the app shape below.

| User does | App calls | Body (app shape) | Reply |
|---|---|---|---|
| Sign up | POST `/api/auth/register` | `{ name, email, password }` | `{ token, user }` |
| Log in | POST `/api/auth/login` | `{ email, password, remember }` | `{ token, user }` |
| App opens | GET `/api/auth/me` | - | `{ user }` or 401 |
| Settings | PATCH `/api/auth/me` | `{ name, bio, avatar }` | `{ user }` |
| Delete account | DELETE `/api/auth/me` | `{ password }` | `{ ok: true }` |
| Send feedback | POST `/api/feedback` | `{ kind, message, appVersion, platform }` | `{ message }` |
| Forgot password | POST `/api/auth/forgot` | `{ email }` | `{ message }` (the code is emailed) |
| New password | POST `/api/auth/reset` | `{ email, code, password }` | `{ token, user }` |
| Check your email | POST `/api/auth/verify` | `{ code }` | `{ user }` (`user.verified` = true) |
| Send a new code | POST `/api/auth/verify/resend` | - | `{ message }` |
| Wrong email? | POST `/api/auth/verify/email` | `{ email }` | `{ message, user }` |
| Dashboard | GET `/api/classes` | - | array of classes |
| Open class | GET `/api/classes/:id` | - | one class |
| Create class | POST `/api/classes` | `{ course, code, section, days:[..], startTime, endTime, lateAfter }` | new class |
| Delete class | DELETE `/api/classes/:id` | - | `{ ok: true }` |
| Pin / unpin | PATCH `/api/classes/:id/pin` | `{ pinned }` | updated class |
| Add student | POST `/api/classes/:id/students` | `{ name, studentId, dept, course }` | updated class |
| Change status | PATCH `/api/classes/:id/students/:sid` | `{ status }` | updated class |
| Remove student | DELETE `/api/classes/:id/students/:sid` | - | updated class |
| **Scan an ID** | POST `/api/classes/:id/scan` | `{ studentId, name, dept, course, add }` | `{ student, class, already }`, or 404 with `code: "NOT_IN_CLASS"` |
| Start attendance (late) | POST `/api/classes/:id/start` | - | updated class |
| Back to schedule | DELETE `/api/classes/:id/start` | - | updated class |
| Close / reopen scanning | POST `/api/classes/:id/close`, `/reopen` | - | updated class |
| Late-after minutes | PATCH `/api/classes/:id` | `{ lateAfter }` | updated class |
| Edit class | PATCH `/api/classes/:id` | `{ course, code, section, days, startTime, endTime, times, lateAfter }` | updated class (attendance already taken stays) |
| A past day | GET `/api/classes/:id?date=YYYY-MM-DD` | - | that day's class (status `null` = no record) |
| Correct a past day | PATCH `/api/classes/:id/students/:sid` | `{ status, date }` | that day's class |
| Import class list | POST `/api/classes/:id/students/import` | `{ students: [{ name, studentId, dept, course }] }` | `{ added, skipped, class }` |
| History / export | GET `/api/classes/:id/attendance?from=&to=` | - | `{ from, to, dates:[..], students:[{ .., statuses }] }` |
| Offline scan | POST `/api/classes/:id/scan` | same + `at: { date, time }` | same |

A class looks like: `{ _id, course, code, section, days: ["Monday","Wednesday"], startTime: "13:00", endTime: "16:00", lateAfter: 15, pinned: false, date, today, session, students: [{ _id, name, studentId, dept, course, status, conflict }] }`.
`status` is that day's status (`null` on a past day = no record). `session` = `{ startTime, adjusted, lateAfter, closed, closedTime, reopened }`:
the start time that counts that day (moved by "Start attendance"), the grace minutes, and whether scanning is closed.
`conflict` = the proxy-scan warning (`{ time, sameTeacher, label }`) or `null`.

### Going live
1. Put the server online first: **backend/DEPLOY.md**.
2. In `eas.json`, replace every `https://CHANGE-ME.example.com/api` with your server (must be **https**).
   A release build with the placeholder shows "no valid server address" instead of failing silently.
3. Publish **PRIVACY.md** somewhere public (Google Docs set to "anyone with the link", Google Sites, the school website,
   or GitHub Pages if the repo is public) and put the address in `PRIVACY_URL` (`src/constants.js`).
4. `npm i -g eas-cli`, `eas login`, then:
   - test build for Android phones: `eas build -p android --profile preview` (an .apk you can install directly)
   - store build: `eas build -p android --profile production` (and `-p ios` for iPhones; needs an Apple Developer account)
5. Go through **TESTING.md** on real phones, then run a one-week pilot.
- App ids are `com.gakupres.app` (`app.json`). **Choose carefully: they can never change after the first store upload.**
- A real build always uses the real server (fake mode only exists while developing).
- `EXPO_PUBLIC_*` values are visible inside the app - **never put secrets there**.

---

## 6. Switches (`src/constants.js`)
| Setting | What it does |
|---|---|
| `MIN_PASSWORD = 8` | minimum password on login + register, and the hint text |
| `PRIVACY_URL` | web address of the privacy policy; empty = the "Privacy policy" links are hidden |
| `GRACE_CHOICES` | the "Late after" minute chips in Create Class and on the class page (`[0, 5, 10, 15, 20, 30]`) |
| `SCAN_COOLDOWN_MS` | ignore the same QR for this long (3000 = 3 s) |
| `MASK_ID_DIGITS` | how many of the first digits of an ID are replaced by one `#` (4: `00001111` -> `#1111`). 0 = show full IDs |
| `LATE_AFTER_MIN` | minutes after the start time that still count as Present, in fake mode (the real server uses `LATE_AFTER_MINUTES` in its `.env`, default 15) |

### Screen sizes
Everything is sized for phones and grows on bigger screens: text sizes scale up to 25% on tablets (`sc` in theme.js),
content stays in a centered column at most 560 wide (`MAX_W`), popups at most 440 wide, and the phone's "large text"
setting is followed up to 1.35x (`MAX_FONT_SCALE`) so layouts don't break.

---

## 7. Ideas not built yet
| # | Idea | How to build it |
|---|---|---|
| 1 | **Delete records after 1 year** (the privacy policy promises this) | A daily job on the server that deletes sessions/records older than one year after the school year ends. Until then, delete old classes by hand once a year. |
| 2 | **Change password in Settings** | `POST /api/auth/password { current, next }` (server checks `current` with bcrypt, hashes `next`, raises `token_version`). "Forgot password" already works. |
| 3 | **Google sign-in** (planned next) | `npx expo install expo-auth-session expo-web-browser`, get an `idToken`, `POST /api/auth/google { idToken }`; the server checks it with `google-auth-library` and replies `{ token, user }` like login. |
| 4 | **Import .xlsx directly** | Import reads CSV (Excel: *File > Save As > CSV*). Reading .xlsx needs an unzip + XML reader (`fflate` is already installed). |
| 5 | **Student accounts** | Decide what students do (see their own attendance?). `GET /api/me/attendance`, linked to their `studentId`. |
| 6 | **PDF export** | Build a PDF of the attendance sheet (e.g. `expo-print`) next to the Excel export. |

Recipe for any new feature: **(1)** write the server route, **(2)** add a function in `src/api/` with a fake branch and a real branch, **(3)** call it from the screen, **(4)** put its words in `content.js`.

---

## 8. Security notes
**Handled in the app**
- Login token is in **SecureStore** (Keychain / Keystore), not plain storage.
- Fake login can't ship: fake mode only exists while developing.
- Ids are URL-encoded before going into request paths.
- 15-second request timeout; a 401 from the server logs the user out.
- Inputs are trimmed and length-limited; passwords need 8+ characters; scanned QR text is capped at 500 characters and only a valid ID number / name / department / course is ever sent (never the date of birth).
- Release builds refuse a placeholder or non-https server address.
- Exported files can't run formulas in Excel (CSV cells starting with = + - @ are escaped; .xlsx cells are plain text).
- The fake database never stores passwords.
- New accounts must enter the 6-digit code emailed to them before anything else works (VerifyEmail screen), so a typo
  or a made-up email is caught at sign-up instead of when "Forgot password" can't reach it.
- The camera permission is asked only when the scanner opens, with a clear reason.

**Handled in the backend** (details in `../backend/README.md`)
- Token checked on every protected route; every class, student and record is checked to **belong to that teacher**.
- Everything validated again (status values, lengths, times, ids); sign-up always makes a teacher account.
- Passwords hashed with bcrypt; login, sign-up, forgot-password and delete-account attempts are rate-limited.
- Changing the password logs out every other phone; reset codes are hashed, expire in 15 minutes, 5 tries.
- Safety headers on every reply, no stack traces in errors, `JWT_SECRET` lives in `.env`.

**Before going live**
- Serve the server over https (Render does it, `../backend/DEPLOY.md`).
- Run `npm audit --registry=https://registry.npmjs.org` now and then.

---

## 9. Expo Go, SDK versions and troubleshooting

**Which Expo Go?** Expo Go only opens projects for the SDK it was built for. Today the stores' Expo Go is **SDK 57**, which is what this project uses (React Native 0.86, React 19.2).

**Heads-up about SDK 58:** Expo's SDK 58 is in beta (since Sept 15, 2026). When it becomes stable, Expo says the **store** Expo Go will switch to 58 and stop opening SDK 57 projects. When that happens:
- either upgrade: `npx expo install expo@^58.0.0 --fix` then `npx expo-doctor` (this project only uses public React Native APIs, which keeps that upgrade small), or
- make a **development build** (recommended before you ship anyway): `npx expo install expo-dev-client`, `npm i -g eas-cli`, `eas build --profile development --platform android` (or `ios`), then `npx expo start --dev-client`.

| Symptom | Fix |
|---|---|
| Expo Go says "incompatible" / can't open | Update Expo Go. Android: `npx expo start --android` installs the right one. iPhone: update from the App Store, or `npx eas-cli go` |
| Crash right after the app opens | A library version doesn't match Expo Go: `npx expo install --fix` then `npx expo start -c` |
| "Cannot reach the server" | Server not running; phone on a different wifi; you used `localhost` instead of the computer's IP; Windows firewall blocking Node |
| Everything still fake | `.env` missing/wrong. Restart with `npx expo start -c` |
| Logged out right after login | Server answered 401: token not verified (check `JWT_SECRET` and the `Authorization` header) |
| Camera black / no scan | Simulators have no camera - use a real phone or the "Simulate scan" button. Check camera permission in phone settings. Hold the ID 10-25 cm away so the QR fills most of the box; use the flashlight in dim rooms |
| "Wrong QR please try again" for a real ID | The QR must hold ID, name, department and course (section 4). Check what is inside with any QR reader app |
| A student of the class gets the "add them?" popup | The ID number in the QR doesn't match that student's **I.D** in this class exactly |
| New image/font not showing | `npx expo start -c` |
| Menu pops up in the wrong place | Menus use `measureInWindow`; the button needs `collapsable={false}` (already set on all of them) |

**Plan B** (if `npm install` fails): make a fresh SDK 57 project and copy this one into it.
```
npx create-expo-app@latest gakupres-app --template blank@sdk-57
cd gakupres-app
npx expo install expo-camera expo-secure-store expo-linear-gradient expo-font expo-status-bar expo-system-ui expo-image-picker expo-image-manipulator expo-file-system expo-sharing expo-document-picker expo-splash-screen react-native-svg react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage @expo-google-fonts/inter @expo-google-fonts/caveat-brush @expo-google-fonts/pixelify-sans
npm install @react-navigation/native @react-navigation/native-stack fflate
npx expo-doctor
```
Then copy this project's `App.js`, `index.js`, `app.json`, `eas.json`, `babel.config.js`, and the `assets/`, `src/` and `tests/` folders over the new ones, and add your `.env`.
