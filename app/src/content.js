// EVERY WORD shown on screen lives here, grouped by page. Edit the text between the quotes.
// Texts that are functions (like (n) => `...${n}`) get a value filled in - keep the ${...} part.
// NOT here (they are data the server also knows): day names, status names -> src/constants.js

export const T = {
  brand: { a: 'GAKU', b: 'PRES' },           // logo text (top bar + login card)
  footer: '© 2026 GakuPres, Inc.',            // bottom of Login / Register

  // ---------------- LOGIN ----------------
  login: {
    title: 'Welcome',
    subtitle: 'Sign in to your account to continue',
    email: 'Email address', emailPh: 'example@gmail.com',
    password: 'Password', passwordPh: '••••••••',
    hint: (n) => `Minimum of ${n} characters or more`,
    remember: 'Remember me',
    button: 'Login', busy: 'Logging in…',
    noAccount: "Don't have an account? ", signUp: 'Sign up',
    errEmpty: 'Enter your email and password.',
    errShort: (n) => `Password must be at least ${n} characters.`,
    forgot: 'Forgot password?',
  },

  // ---------------- FORGOT PASSWORD ----------------
  forgot: {
    title: 'Reset password',
    emailHelp: "Enter your account's email. We'll send you a 6-digit code.",
    send: 'Send code', sending: 'Sending…',
    code: '6-digit code', newPassword: 'New password',
    save: 'Set new password', saving: 'Saving…',
    again: 'Send a new code', back: 'Back to login',
    errEmail: 'Enter a valid email address.',
    errCode: 'Enter the 6-digit code from the email.',
  },

  // ---------------- REGISTER ----------------
  register: {
    title: 'Register',
    name: 'Full name', namePh: 'Full name',
    email: 'Email address', emailPh: 'example@gmail.com',
    password: 'Password', passwordPh: '••••••••',
    hint: (n) => `Minimum of ${n} characters or more`,
    confirm: 'Confirm password',
    button: 'Sign up', busy: 'Creating account…',
    haveAccount: 'Already have an account? ', login: 'Login',
    agree: 'By signing up you agree to the ', privacy: 'Privacy Policy',
    errEmpty: 'Please fill in every field.',
    errShort: (n) => `Password must be at least ${n} characters.`,
    errMatch: "Passwords don't match.",
  },

  // ---------------- DASHBOARD (class list) ----------------
  dashboard: {
    loading: 'Loading classes…',
    empty: 'Add a class to get started',
    create: 'Create class',                    // button at the bottom
    classTitle: (c) => `${c.code} - Section ${c.section}`,
    pin: 'Pin', unpin: 'Unpin',
    menu: { feedback: 'Feedback', settings: 'Settings', logout: 'Log Out' },  // avatar menu
    logoutTitle: 'Scans not uploaded yet',
    logoutBody: (n) => `${n} scan${n === 1 ? ' is' : 's are'} saved on this phone and not uploaded yet. If you log out now and someone else logs in, they may be lost. Log out anyway?`,
  },

  // ---------------- CREATE CLASS ----------------
  createClass: {
    title: 'Create Class',
    course: 'Course:', coursePh: 'ITPE - 4',
    code: 'Code:', codePh: '4ITPE3',
    section: 'Section:', sectionPh: '1',
    days: 'Days:', daysPh: 'Select days',
    start: 'Start Time:', end: 'End Time:', timePh: 'Select time',
    startTitle: 'Start time', endTitle: 'End time', setTime: 'Set',
    grace: 'Late after:', graceHint: 'minutes after the start time = Late',
    done: 'Done', busy: 'Saving…',
    // the same form edits a class (class page > Edit)
    editTitle: 'Edit Class', save: 'Save', loading: 'Loading…',
    errEmpty: 'Fill in every field first.',
    errTime: 'End time must be after start time.',
    // "Non-uniform time" checkbox (above the days): a different start/end time for each picked day
    perDay: 'Non-uniform time', perDayHint: 'A different start and end time for each day',
    perDayPick: 'Pick the days first, then set the time for each one.',
    errDayTime: (d) => `Set the start and end time for ${d}.`,
    errDayOrder: (d) => `${d}: end time must be after start time.`,
  },

  // ---------------- CLASS DETAIL ----------------
  classDetail: {
    colName: 'Name', colId: 'I.D', colCourse: 'Course', colStatus: 'Status',
    noStudents: 'No students yet.',
    remove: 'Remove',
    deleteTitle: 'Delete this class?',
    deleteBody: (c) => `${c.code} - Section ${c.section} and all of its attendance will be removed. This can't be undone.`,
    delete: 'Delete',
    addTitle: 'Add student',
    addName: 'Name:', addId: "I.D (same number as in their ID's QR):", addDep: 'Dep.:', addCourse: 'Course (optional):',
    add: 'Add', adding: 'Adding…', errFill: 'Fill in the name, I.D and department.',
    errId: 'The I.D can only have letters, numbers, # and dashes.',
    // "Start attendance" (teacher is running late: Present/Late counts from when they start, the end time stays)
    start: 'Start attendance now',
    startBusy: 'Starting…',
    startedAt: (t) => `Attendance started at ${t}`,     // t = "1:20 pm"
    lateAfter: (t) => `Late after ${t}`,
    reset: 'Use schedule',
    lateTitle: 'Running late?',
    lateBody: (start, now) => `This class was scheduled to start at ${start}. Start attendance now (${now}) so students who arrive in the next minutes aren't marked Late? The end time stays the same.`,
    lateYes: 'Start now', lateNo: 'Keep schedule',
    // close / reopen scanning for today
    closed: 'Attendance closed',
    closedAt: (t) => `Attendance closed at ${t}`,
    close: 'Close attendance', reopen: 'Reopen',
    closeTitle: 'Close attendance?',
    closeBody: "Scanning stops for today. Students who weren't scanned stay Absent. You can reopen it any time.",
    // late grace minutes (tap "Late after ...")
    graceTitle: 'Late after how many minutes?',
    graceBody: (t) => `Students scanned more than this many minutes after the start (${t}) are marked Late.`,
    save: 'Save',
    // day picker + history
    today: 'Today',
    pastNote: "Past day: changing a status corrects that day's record.",
    holdName: 'Hold to see the full name',
    noRecord: '—',
    history: 'History',
    edit: 'Edit',
    // add students
    addOne: 'Add one student', importList: 'Import class list (CSV)',
    classList: 'Class list: import or export',   // the button that pops open the two below
    importBtn: 'Import', exportBtn: 'Export',
    exportTitle: 'Save or send the class list',
    // offline
    offline: 'No connection - showing the last saved copy.',
    pending: (n) => `${n} scan${n === 1 ? '' : 's'} saved offline, waiting to upload`,
    uploadNow: 'Upload now',
    // proxy-scan warning (same student scanned in another class at the same time today)
    proxyLegend: '⚠ = also scanned in another class at the same time today. Check the student is really here.',
    dropped: (n, why) => `${n} offline scan${n === 1 ? " wasn't" : "s weren't"} saved: ${why}`,
  },

  // ---------------- IMPORT CLASS LIST ----------------
  importList: {
    title: 'Import class list',
    help: 'Pick a CSV file with the columns ID, Name, Department, Course (a header row is fine; Last name / First name columns work too).\nFrom Excel or Google Sheets: File > Save As / Download > CSV.',
    pick: 'Choose file', reading: 'Reading…',
    notCsv: 'That is not a CSV file. In Excel use File > Save As > CSV, then pick that file.',
    tooBig: 'That file is too big (max 1 MB).',
    empty: 'No students found in that file.',
    found: (n) => `Found ${n} student${n === 1 ? '' : 's'}:`,
    more: (n) => `…and ${n} more`,
    skippedRows: (n) => `${n} row${n === 1 ? '' : 's'} will be skipped:`,
    row: (r) => `Row ${r.row}: ${r.reason}`,
    import: (n) => `Import ${n}`, importing: 'Importing…',
    done: (added, skipped) => `Added ${added} student${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already in the class or invalid` : ''}.`,
    close: 'Close',
  },

  // ---------------- ATTENDANCE HISTORY ----------------
  history: {
    title: 'Attendance history',
    ranges: { week: 'Last 7 days', month: 'This month', d30: 'Last 30 days', year: 'Last 12 months' },
    loading: 'Loading…',
    none: 'No attendance was taken in this period.',
    counts: (d) => `${d.present} present • ${d.late} late • ${d.excuse} excused • ${d.absent} absent`,
    started: (t) => `started late, ${t}`,
    days: (n) => `${n} day${n === 1 ? '' : 's'} with attendance`,
    export: 'Export to Excel (.xlsx)', exporting: 'Preparing file…',
    shareTitle: 'Save or send the attendance file',
    noShare: "This phone can't share files.",
  },

  // ---------------- QR SCANNER ----------------
  scan: {
    title: 'Scan student ID',
    date: (d) => `Attendance for: ${d}`,             // d = today as MM/DD/YYYY
    present: (n, total) => `${n}/${total} present`,
    lateAfter: (t) => `Late after ${t}`,
    hint: 'Hold the ID QR code inside the box',
    checking: 'Checking…',
    done: (n) => `Done (${n})`,                       // n = students marked during this scan
    simulate: 'Simulate scan (dev only)',
    permText: 'GakuPres needs the camera to read student ID QR codes.',
    allow: 'Allow camera', openSettings: 'Open settings', back: 'Back',
    camError: 'The camera could not start. Close other apps using it and try again.',
    marked: (s) => `${s.name} - ${s.status}`,
    already: (s) => `${s.name} was already marked ${s.status}`,
    // "wrong QR" popup
    wrongTitle: 'Wrong QR please try again',
    wrongBody: 'This is not a student ID QR code, or it could not be read.',
    tryAgain: 'Try again',
    // "not in class" popup
    notInClass: 'Student not in class, add them?',
    idLbl: 'I.D', deptLbl: 'Department', courseLbl: 'Course',
    add: 'Add', adding: 'Adding…',
    // closed (after the end time, or "Close attendance")
    closedTitle: 'Attendance is closed',
    closedBody: 'The class has ended or attendance was closed. Reopen it to keep scanning.',
    reopen: 'Reopen scanning',
    // offline
    savedOffline: 'Saved offline - uploads when the connection is back',
    proxy: (c) => `⚠ Also scanned in ${c.label || 'another class'} at ${c.time} today`,
    pending: (n) => `${n} waiting to upload`,
    // other errors
    errTitle: 'Could not mark attendance',
    ok: 'OK',
  },
  //---------------- SETTINGS ----------------
  settings: {
    title: 'Settings',
    photo: 'Change profile photo',
    photoPerm: 'We need permission to open your photos.',
    photoBad: 'That picture could not be opened. Try another one.',
    name: 'Display name', namePh: 'Your name',
    bio: 'Bio', bioPh: 'A short note about you (optional)',
    save: 'Save', saving: 'Saving…',
    saved: 'Saved!',
    errName: 'Name cannot be empty.',
    // delete account (bottom of Settings)
    privacy: 'Privacy policy',
    danger: 'Delete account',
    dangerBody: 'Deletes your account and all of your classes, students and attendance records. This cannot be undone.',
    deleteTitle: 'Delete your account?',
    deleteBody: 'All of your classes, students and attendance will be deleted for good. Export anything you need first (class page > History > Export). Type your password to confirm.',
    deletePh: 'Your password',
    deleteBtn: 'Delete forever', deleting: 'Deleting…',
    errPassword: 'Enter your password.',
  },

  // ---------------- VERIFY EMAIL (after sign-up, until the emailed code is entered) ----------------
  verify: {
    title: 'Check your email',
    sentTo: 'We sent a 6-digit code to ', sentTo2: '. Enter it below to finish signing up. Check spam too.',
    code: 'Code from the email',
    verify: 'Verify', checking: 'Checking…',
    errCode: 'Enter the 6-digit code from the email.',
    resend: 'Send a new code', resendIn: (s) => `Send a new code in ${s}s`,
    wrong: 'Wrong email? ', change: 'Change it',
    newEmail: 'Your correct email',
    sendHere: 'Send the code here', sending: 'Sending…', waitBtn: (s) => `Wait ${s}s`,
    errEmail: 'Enter your email.',
    logout: 'Log out',
  },

  // ---------------- FEEDBACK (avatar menu > Feedback) ----------------
  feedback: {
    title: 'Feedback',
    help: 'Found a problem or have an idea? Tell the GakuPres Team.',
    kind: 'What is it about?',
    kinds: [['Bug', 'Something is wrong'], ['Idea', 'An idea'], ['Other', 'Other']], // [sent to server, shown]
    message: 'Your message',
    placeholder: {
      Bug: 'What happened? What did you tap just before? Which screen?',
      Idea: 'What would make GakuPres better for you?',
      Other: 'Write anything you want us to know.',
    },
    send: 'Send', sending: 'Sending…',
    errShort: 'Write a little more so we know what you mean.',
    note: 'Your name and email are sent with it so we can reply.',
    thanks: 'Thank you!',
    thanksBody: 'Your feedback was sent to the GakuPres Team.',
    back: 'Back',
  },

  common: { cancel: 'Cancel' },
};