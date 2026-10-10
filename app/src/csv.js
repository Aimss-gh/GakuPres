// CSV files: reading and writing the class list (import / export). The attendance report is .xlsx (src/xlsx.js).
// Excel: "File > Save As > CSV" makes a file this can read, and the exported .csv opens in Excel.
import { fieldOf } from './qr';

// ---------- reading ----------
// Handles quotes ("Dela Cruz, Juan"), CRLF / LF, a UTF-8 BOM, and , ; or tab separators
// (Excel in some countries saves with ;).
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = [',', ';', '\t'].map((s) => [s, firstLine.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];

  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const ID_OK = /^[A-Za-z0-9#][A-Za-z0-9#-]*$/;

// Class list rows -> students. With a header row (ID / Name / Department / Course in any order,
// same labels the QR reader knows) or without one: ID, Name, Department, Course.
// -> { students: [{ studentId, name, dept, course, row }], skipped: [{ row, reason }] }
export function rowsToStudents(rows) {
  let cols = { studentId: 0, name: 1, dept: 2, course: 3 };
  let start = 0;
  const labels = (rows[0] || []).map((h) => String(h).toLowerCase().replace(/[^a-z]/g, ''));
  const header = (rows[0] || []).map(fieldOf);
  const at = (...names) => labels.findIndex((l) => names.includes(l));
  // names split over columns: Last name / First name / Middle (initial)
  const split = { last: at('lastname', 'surname', 'familyname'), first: at('firstname', 'givenname'), mid: at('middlename', 'middleinitial', 'mi', 'middle') };
  if (header.includes('studentId') && (header.includes('name') || (split.last >= 0 && split.first >= 0))) {
    cols = Object.fromEntries(['studentId', 'name', 'dept', 'course'].map((k) => [k, header.indexOf(k)]));
    start = 1;
  }

  const students = [], skipped = [];
  const seen = new Set();
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    // (a leading ' that our export put before = + - @ is removed again)
    const raw = (c) => (c >= 0 ? String(r[c] ?? '').replace(/\s+/g, ' ').trim().replace(/^'(?=[=+\-@])/, '') : '');
    const get = (k) => raw(cols[k]);
    const name = cols.name >= 0 ? get('name') : `${raw(split.last)}, ${raw(split.first)} ${raw(split.mid)}`.replace(/^, |,\s*$/g, '').trim();
    const s = { studentId: get('studentId').replace(/\s+/g, ''), name: name.slice(0, 80), dept: get('dept').slice(0, 40), course: get('course').slice(0, 40), row: i + 1 };
    if (!s.studentId || !s.name || !s.dept) skipped.push({ row: i + 1, reason: 'missing ID, name or department' });
    else if (s.studentId.length > 30 || !ID_OK.test(s.studentId)) skipped.push({ row: i + 1, reason: `bad ID "${s.studentId.slice(0, 30)}"` });
    else if (seen.has(s.studentId)) skipped.push({ row: i + 1, reason: `ID ${s.studentId} is listed twice` });
    else { seen.add(s.studentId); students.push(s); }
  }
  return { students, skipped };
}

// ---------- writing ----------
// A cell that starts with = + - @ could run as a formula in Excel ("CSV injection"), so it gets a ' in front.
const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'; // BOM = Excel reads ñ, é correctly

// The class list (same columns the import reads, so it can be imported into another class).
// Full IDs on purpose: the # on screen is only for display.
export const classListCsv = (cls) =>
  toCsv([['ID', 'Name', 'Department', 'Course'], ...cls.students.map((s) => [s.studentId, s.name, s.dept, s.course])]);

// safe file name: "GakuPres_4ITPE3_S1_class_list.csv"
const safe = (s) => s.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 100) + '.csv';
export const classListName = (cls) => safe(`GakuPres_${cls.code}_S${cls.section}_class_list`);
