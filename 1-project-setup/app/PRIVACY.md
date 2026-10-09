# GakuPres Privacy Policy

**Last updated:** October 9, 2026
**Operated by:** WIT-BSIT, GakuPres Team

GakuPres is an attendance app for teachers. Teachers scan the QR code on a student's ID card to record
attendance. This policy explains what information the app handles, why, and the rights of teachers and students
under the Data Privacy Act of 2012 (Republic Act No. 10173).

---

## 1. Information we collect

### Teachers (account holders)
- **Name and email address** - to create the account and log in.
- **Password** - stored only as a one-way hash (bcrypt). Nobody, including us, can read it.
- **Optional profile details** - a short bio and a profile picture, if the teacher adds them.
- **Email verification and password reset codes** - at sign-up, and when "Forgot password" is used, a 6-digit code is emailed to check that the email belongs to the teacher. Only a hash of it is stored, and it expires after 15 minutes.
- **Feedback** - if the teacher sends feedback (menu > Feedback): the message, its type (problem / idea / other), the app
  version and the phone system (for example "android 34"). It is emailed to the GakuPres Team with the teacher's name and email so we can reply.

### Students (entered by their teachers)
- **From the student ID QR code:** student ID number, name, department and course.
  The QR code also contains the **date of birth. The app skips it on the phone. It is never sent to our server or stored.**
- **Attendance records:** for each class day, the status (Present, Late, Excused, Absent), the time of the scan,
  and whether the same student ID was scanned in another class at an overlapping time on the same day (see section 3).
- Teachers may also add students by hand or by importing a class list file with the same fields.

### On the teacher's phone
- **Camera:** used only while the scanner is open, to read QR codes. Camera images are not saved or sent anywhere.
- **Photos:** accessed only if the teacher chooses a profile picture.
- **Stored on the phone:** the login token (in the phone's secure storage), a copy of the last loaded class list, and
  scans saved while offline until they are uploaded.
- **Files:** attendance or class-list files are created only when the teacher taps Export, and are shared only where the teacher chooses.

We do **not** collect location, contacts, advertising identifiers, or usage analytics, and the app shows no ads.

## 2. Why we use it

- To record and show class attendance, and to mark students Present or Late based on the class time.
- To let teachers view past attendance and export it for school records.
- To keep accounts secure (login, password reset, limits on login attempts).
- To read and answer feedback and fix the problems teachers report.

Legal basis: the processing is necessary for the school's educational and administrative functions, and is done
by authorized teachers, as part of the school's normal function of keeping class attendance.

## 3. Who can see it

- **The teacher who owns a class** sees that class's students and attendance. Other teachers cannot.
- **Proxy-scan warning:** if a student's ID is scanned in two classes whose times overlap on the same day, both teachers
  see a warning with the time of the other scan. Another teacher's class name is never shown.
- **Service providers** that run the system for us, under agreements to protect the data:
  - Server hosting: Render (render.com), Singapore
  - Database: MongoDB Atlas on Google Cloud, Singapore
  - Email (verification and password reset codes, feedback): Gmail (Google)
- We **never sell** personal data or share it for advertising.
- We disclose data to authorities only when required by law.

## 4. How long we keep it

- Attendance and student records stay until the teacher deletes the class or their account, or until
  one year after the end of the school year, whichever comes first.
- Feedback is kept until it has been handled, and at most one year.
- A sign-up whose email is never verified can be removed after one day.
- **Deleting an account** (Settings > Delete account) permanently deletes the account and all of its classes,
  students, attendance records and feedback from our database (feedback emails already received by the team are deleted by hand on request). Copies already exported by the teacher are not affected.
- We do not keep separate database backups. Teachers can export attendance (History > Export) to keep their own copy.

## 5. How we protect it

- All connections use encryption (HTTPS).
- Passwords and reset codes are stored only as hashes. Logins expire, and changing the password ends every other login.
- Each class is checked to belong to the logged-in teacher on every request.
- Login and password-reset attempts are rate-limited.
- Access to the server and database is limited to the GakuPres Team developers.

## 6. Your rights

Under the Data Privacy Act, teachers and students (or their parents or guardians, for minors) have the right to:
be informed, access their data, correct it, object to processing, have it erased or blocked, data portability,
and to file a complaint with the **National Privacy Commission** (www.privacy.gov.ph).

- **Teachers** can view, correct and delete their own data in the app (Settings).
- **Students** can ask their teacher to see, correct or remove their records.
  We will reply within reasonable days.

## 7. Children

Many students are minors. Student records are entered only by school staff, for school purposes. Students do not
create accounts or use the app.

## 8. Changes

If this policy changes, we will update the date at the top and tell teachers in the app or by email before major changes take effect.
