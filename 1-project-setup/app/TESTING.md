# Real-phone test run (before release)

`npm test` checks the app's logic and `npm test` in backend/ checks the server. This list covers what
only a real phone and a real class can show. Do it with the **real server** (`.env`: `EXPO_PUBLIC_USE_MOCK=false`),
then once more with an installed **preview build** (`eas build -p android --profile preview`).
Tick each box; note the phone model and anything odd.

Phones: [ ] Android ______  [ ] iPhone ______ (if teachers use them)

## Account
- [ ] Sign up -> "Check your email" -> the code arrives (check spam) -> Verify -> dashboard
- [ ] On "Check your email": wrong code shows an error, "Send a new code" waits 15 seconds, "Wrong email? Change it" sends the code to the new address
- [ ] Log out, log in again ("Remember me" on and off)
- [ ] Forgot password: code arrives by email (check spam), wrong code refused, new password works, the other phone gets logged out
- [ ] Settings: change name, photo, bio; they stay after closing the app
- [ ] Delete account (use a test account!): needs the password, then you're logged out and can't log in

## Class
- [ ] Create a class with each "Late after" choice you'll use; edit "Late after" on the class page
- [ ] Add one student by hand; import a class list CSV saved from Excel (with a header, and with Last/First name columns)
- [ ] Export the class list and attendance; open both files in Excel / Google Sheets (names with ñ look right)
- [ ] History: past days open, correcting a past status works

## Scanning (with real student ID cards)
- [ ] Camera fills the screen; "Attendance for: <today>" is right
- [ ] 10+ real IDs in a row: each reads within ~1-2 s, correct name, Present before the late mark, Late after
- [ ] Dim room with the flashlight; scratched / laminated / tilted cards; card held far and close
- [ ] Same ID twice: "already marked", no double count
- [ ] A random QR (website, Wi-Fi code): "Wrong QR please try again"
- [ ] A student not in the class: "add them?" -> Add marks them; Cancel goes back to scanning
- [ ] Start attendance late: "Running late?" appears, students count from the new start
- [ ] Close attendance: scanning stops; Reopen works; after the end time it closes by itself
- [ ] Two overlapping classes, same student: the warning shows in both

## Offline
- [ ] Open the class with wifi, then turn on airplane mode and scan 3 students: "Saved offline"
- [ ] Turn the connection back on: the scans upload by themselves, with Present/Late from the real scan time
- [ ] Log out with scans waiting: the warning appears

## Phone situations
- [ ] Rotate / small phone / big phone / tablet: nothing cut off
- [ ] Phone text size set to largest: still readable, buttons still work
- [ ] Switch to another app mid-scan and back; lock the screen and unlock
- [ ] Deny camera permission, then allow it from the phone's settings

## Pilot
One teacher, one real class, one week. Collect: anything confusing, any wrong Present/Late, how long a full class takes to scan.
