// Reads the QR printed on a student's ID card.
// It must hold, in this order: ID number, name, department, course, date of birth (the DoB is ignored).
// Accepted layouts:
//   one value per line, or separated by  |  ;  tab  or  ,
//       00001111|Juan Dela Cruz|CCS|BSIT|01/01/2001
//   labelled values (any order):
//       ID: 00001111
//       Name: Juan Dela Cruz
//       Department: CCS
//       Course: BSIT
//       Birthday: 01/01/2001
//   JSON:  {"id":"00001111","name":"Juan Dela Cruz","department":"CCS","course":"BSIT","dob":"2001-01-01"}
// Returns { studentId, name, dept, course } or null when the QR isn't a student ID.

// label (letters only, lowercase) -> field
const LABELS = {
  studentId: ['id', 'idno', 'idnumber', 'studentid', 'studentno', 'studentnumber', 'studno', 'number', 'no'],
  name: ['name', 'fullname', 'studentname'],
  dept: ['department', 'dept', 'dep', 'college'],
  course: ['course', 'program', 'programme', 'degree'],
  dob: ['dob', 'birthday', 'birthdate', 'dateofbirth', 'bday', 'birth'],
};
export const fieldOf = (label) => {
  const k = String(label).toLowerCase().replace(/[^a-z]/g, '');
  return Object.keys(LABELS).find((f) => LABELS[f].includes(k));
};

const looksLikeDate = (s) =>
  /\d{1,4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,4}/.test(s) ||
  /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d/i.test(s);

// first separator that gives at least 4 values wins (newline first, so commas inside a name survive)
function split(text) {
  for (const sep of [/\r?\n/, '|', ';', '\t', ',']) {
    const parts = text.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 4) return parts;
  }
  return null;
}

function fromJson(text) {
  if (!text.startsWith('{')) return null;
  try {
    const o = JSON.parse(text);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const f = {};
    for (const [k, v] of Object.entries(o)) {
      const key = fieldOf(k);
      if (key && (typeof v === 'string' || typeof v === 'number')) f[key] = String(v);
    }
    return f;
  } catch {
    return null;
  }
}

function fromLabels(parts) {
  const f = {};
  for (const p of parts) {
    const m = p.match(/^([A-Za-z][A-Za-z ._#'-]{0,24}?)\s*[:=]\s*(.+)$/);
    const key = m && fieldOf(m[1]);
    if (key && !f[key]) f[key] = m[2];
  }
  return f.studentId && f.name ? f : null;
}

function fromPositions(p) {
  const n = p.length;
  if (n === 4) return { studentId: p[0], name: p[1], dept: p[2], course: p[3] };
  // 5+ values: the last one is the birthday when it looks like a date; anything extra
  // in the middle is a name that had the separator inside it ("Dela Cruz, Juan")
  const tail = looksLikeDate(p[n - 1]) ? 1 : 0;
  return {
    studentId: p[0],
    name: p.slice(1, n - 2 - tail).join(', '),
    dept: p[n - 2 - tail],
    course: p[n - 1 - tail],
  };
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function parseStudentQr(raw) {
  const text = String(raw ?? '').replace(/^﻿/, '').trim();
  if (!text || text.length > 500) return null;

  let f = fromJson(text);
  if (!f) {
    const parts = split(text);
    if (!parts) return null;
    f = fromLabels(parts) || fromPositions(parts);
  }

  const s = {
    studentId: clean(f.studentId, 30).replace(/\s+/g, ''),
    name: clean(f.name, 80),
    dept: clean(f.dept, 40),
    course: clean(f.course, 40),
  };
  if (!/^[A-Za-z0-9#][A-Za-z0-9#-]{0,29}$/.test(s.studentId) || !/[A-Za-z0-9]/.test(s.studentId)) return null;
  if (!/[A-Za-zÀ-ɏ]/.test(s.name) || !s.dept || !s.course) return null;
  return s;
}

// The text a test QR should contain (used by the dev-only "Simulate scan" button)
export const makeStudentQr = (s, dob = '01/01/2001') => [s.studentId, s.name, s.dept, s.course || 'BSIT', dob].join('|');
