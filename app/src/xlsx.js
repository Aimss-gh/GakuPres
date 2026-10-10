// Excel (.xlsx) attendance report, made on the phone (works offline and in fake-data mode too).
// An .xlsx file is a zip of a few XML files; fflate does the zipping.
//   attendanceXlsx(cls, history) -> Uint8Array (the file)   |   xlsxName(cls, history) -> file name
// Look of the sheet (colors, widths) -> STYLES and the builders below.
import { strToU8, zipSync } from 'fflate';
import { fmtTime, parseDay } from './utils';

// ---------- tiny workbook writer ----------
// sheet = { name, widths: [14, 28, ...], freeze: { cols, rows }, rows: [[cell, ...], ...] }
// cell  = 'text' | 12 | { v: 'text' | 12, s: STYLE }   (null / undefined = empty)
const esc = (s) => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '') // characters XML can't hold
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function cellXml(cell, ref) {
  if (cell === null || cell === undefined) return '';
  const { v, s = 0 } = typeof cell === 'object' ? cell : { v: cell };
  if (v === null || v === undefined || v === '') return s ? `<c r="${ref}" s="${s}"/>` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  // text is always stored as text, so IDs like 00001111 keep their zeros and nothing is read as a formula
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml({ widths = [], freeze, rows }) {
  const pane = freeze && (freeze.cols || freeze.rows)
    ? `<sheetViews><sheetView workbookViewId="0"><pane${freeze.cols ? ` xSplit="${freeze.cols}"` : ''}${freeze.rows ? ` ySplit="${freeze.rows}"` : ''} topLeftCell="${colName(freeze.cols || 0)}${(freeze.rows || 0) + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : '';
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const data = rows.map((r, y) => `<row r="${y + 1}">${(r || []).map((c, x) => cellXml(c, `${colName(x)}${y + 1}`)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${data}</sheetData></worksheet>`;
}

// ---------- styles (index = position in cellXfs below) ----------
export const STYLE = { title: 1, header: 2, text: 3, Present: 4, Late: 5, Excuse: 6, Absent: 7, num: 8, note: 9, none: 10, muted: 11 };
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font>'
  + '<font><i/><sz val="10"/><color rgb="FF7F7F7F"/><name val="Calibri"/></font></fonts>'
  + '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + ['FFFF6417', 'FFC6EFCE', 'FFFFEB9C', 'FFE7E6E6', 'FFFFC7CE'].map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')
  + '</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
  + '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                                                     // 0 default
  + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'                                       // 1 title
  + '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' // 2 header
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>'                                     // 3 text
  + [3, 4, 5, 6].map((f) => `<xf numFmtId="0" fontId="1" fillId="${f}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>`).join('') // 4-7 P L E A
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' // 8 number
  + '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf>' // 9 note (start times)
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>'                                     // 10 empty cell with border
  + '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>'                                       // 11 muted note
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const safeSheetName = (s, i) => (String(s).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`);

// sheets -> the .xlsx file as bytes
export function buildXlsx(sheets) {
  const ns = 'http://schemas.openxmlformats.org/';
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>',
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${ns}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}spreadsheetml/2006/main" xmlns:r="${ns}officeDocument/2006/relationships"><sheets>`
      + sheets.map((s, i) => `<sheet name="${esc(safeSheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships">`
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="${ns}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
}

// ---------- the attendance report ----------
const LETTER = { Present: 'P', Late: 'L', Excuse: 'E', Absent: 'A' };
const shortDay = (d) => { const x = parseDay(d); return `${x.getMonth() + 1}/${x.getDate()}`; };   // "10/8"

// history (from getHistory) -> .xlsx bytes
//   Sheet "Attendance": one row per student, one column per day (P / L / E / A, colored), totals at the end
//   Sheet "Days": one row per day with its counts
export function attendanceXlsx(cls, h) {
  const days = h.dates.map((d) => d.date);
  const S = STYLE;
  const head = ['Student ID', 'Name', 'Department', 'Course', ...days.map(shortDay), 'Present', 'Late', 'Excuse', 'Absent']
    .map((v) => ({ v, s: S.header }));
  const starts = [{ v: '', s: S.none }, { v: 'Start time', s: S.note }, { v: '', s: S.none }, { v: '', s: S.none },
    ...h.dates.map((d) => ({ v: fmtTime(d.startTime) + (d.adjusted ? ' (late start)' : ''), s: S.note })), ...[0, 0, 0, 0].map(() => ({ v: '', s: S.none }))];
  const body = h.students.map((st) => {
    const count = (x) => days.filter((d) => st.statuses[d] === x).length;
    return [
      { v: st.studentId, s: S.text }, { v: st.name, s: S.text }, { v: st.dept, s: S.text }, { v: st.course, s: S.text },
      ...days.map((d) => (st.statuses[d] ? { v: LETTER[st.statuses[d]], s: S[st.statuses[d]] } : { v: '', s: S.none })),
      ...['Present', 'Late', 'Excuse', 'Absent'].map((x) => ({ v: count(x), s: S.num })),
    ];
  });
  const attendance = {
    name: 'Attendance',
    widths: [14, 28, 13, 12, ...days.map(() => 7), 9, 7, 8, 8],
    freeze: { cols: 2, rows: 5 },
    rows: [
      [{ v: `${cls.course}  •  ${cls.code} - Section ${cls.section}`, s: S.title }],
      [{ v: `Attendance from ${h.from} to ${h.to}`, s: S.muted }],
      [{ v: 'P = Present   L = Late   E = Excused   A = Absent   (blank = no record that day)', s: S.muted }],
      head,
      starts,
      ...body,
    ],
  };

  const dayRows = [...h.dates].reverse().map((d) => [
    { v: d.date, s: S.text }, { v: fmtTime(d.startTime) + (d.adjusted ? ' (late start)' : ''), s: S.text },
    { v: d.present, s: S.num }, { v: d.late, s: S.num }, { v: d.excuse, s: S.num }, { v: d.absent, s: S.num }, { v: d.total, s: S.num },
  ]);
  const summary = {
    name: 'Days',
    widths: [13, 18, 9, 7, 8, 8, 8],
    freeze: { rows: 1 },
    rows: [['Date', 'Start time', 'Present', 'Late', 'Excuse', 'Absent', 'Students'].map((v) => ({ v, s: S.header })), ...dayRows],
  };
  return buildXlsx([attendance, summary]);
}

// "GakuPres_4ITPE3_S1_2026-09-09_to_2026-10-08.xlsx"
export const xlsxName = (cls, h) => `GakuPres_${cls.code}_S${cls.section}_${h.from}_to_${h.to}`.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 100) + '.xlsx';
