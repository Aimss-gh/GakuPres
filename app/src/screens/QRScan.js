// QR SCANNER - the teacher points the camera at the QR on each student's ID
//   texts  -> src/content.js  (T.scan)
//   what the QR must contain -> src/qr.js
//   timings / Present-Late rule -> src/constants.js
//
//   The camera fills the screen and reads every QR that enters the box:
//     student in the class      -> marked Present or Late (by the class start time) automatically
//     student NOT in the class  -> popup "Student not in class, add them?"  [Cancel] [Add]
//     not a student ID / broken -> popup "Wrong QR please try again"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import Btn from '../components/Btn';
import Dialog, { DialogActions } from '../components/Dialog';
import { getClass, reopenAttendance, scanStudent } from '../api/classApi';
import { flushScans, onQueueChange, pendingScans } from '../api/offline';
import { USE_MOCK } from '../api/http';
import { makeStudentQr, parseStudentQr } from '../qr';
import { SCAN_COOLDOWN_MS } from '../constants';
import { T } from '../content';
import { fmtDateMDY, fmtTime, lateAfterTime, maskId, presentCount } from '../utils';
import { C, F, FS, MAX_W, sc, statusTint } from '../theme';

const DIM = 'rgba(0,0,0,0.55)';
const buzzOk = () => Vibration.vibrate(60);
const buzzBad = () => Vibration.vibrate([0, 80, 60, 80]);

export default function QRScan({ route, navigation }) {
  const L = T.scan;
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const focused = useIsFocused(); // camera runs only while this screen is on top
  const [perm, askPerm] = useCameraPermissions();
  const [cls, setCls] = useState(null);
  const [torch, setTorch] = useState(false);
  const [count, setCount] = useState(0);         // students marked during this scan
  const [result, setResult] = useState(null);    // last scan: { student, already }
  const [checking, setChecking] = useState(false);
  const [popup, setPopup] = useState(null);      // { kind: 'wrong' } | { kind: 'add', s } | { kind: 'error', text }
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [camErr, setCamErr] = useState(false);
  const [area, setArea] = useState(null);        // size of the space between the top bar and the bottom panel
  const [pending, setPending] = useState(0);     // scans saved offline, not uploaded yet
  const [reopening, setReopening] = useState(false);
  const lock = useRef(false);                    // true while a QR is being handled or a popup is open
  const last = useRef({ data: '', t: 0 });
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const refresh = useCallback(() => getClass(id).then((c) => live.current && setCls(c)).catch(() => {}), [id]);
  useEffect(() => { refresh(); }, [refresh]);

  // real server: keep trying to upload scans saved offline while the scanner is open
  useEffect(() => {
    if (USE_MOCK) return undefined;
    pendingScans(id).then((l) => live.current && setPending(l.length));
    const off = onQueueChange((list) => live.current && setPending(list.filter((x) => x.classId === id).length));
    const t = setInterval(() => { flushScans().then(({ sent }) => sent && refresh()).catch(() => {}); }, 15000);
    return () => { off(); clearInterval(t); };
  }, [id, refresh]);

  // the date updates by itself if the scanner is left open past midnight
  const [date, setDate] = useState(fmtDateMDY());
  useEffect(() => {
    const t = setInterval(() => setDate(fmtDateMDY()), 30000);
    return () => clearInterval(t);
  }, []);

  const marked = useCallback((r) => {
    if (!live.current) return;
    setCls(r.class);
    setResult({ student: r.student, already: r.already, offline: !!r.offline });
    if (!r.already) setCount((n) => n + 1);
  }, []);

  // closes a popup and keeps ignoring the same QR for a moment, so it doesn't pop right back up
  const release = useCallback(() => {
    last.current = { ...last.current, t: Date.now() };
    lock.current = false;
  }, []);
  const closePopup = useCallback(() => {
    setPopup(null);
    setAddErr('');
    release();
  }, [release]);

  const handle = useCallback(async (raw) => {
    const data = String(raw ?? '');
    const now = Date.now();
    if (lock.current || (data === last.current.data && now - last.current.t < SCAN_COOLDOWN_MS)) return;
    lock.current = true;
    last.current = { data, t: now };

    const s = parseStudentQr(data);
    if (!s) {
      buzzBad();
      setPopup({ kind: 'wrong' });
      return; // stays locked until the popup is closed
    }
    setChecking(true);
    try {
      const r = await scanStudent(id, s);
      buzzOk();
      marked(r);
      release();
    } catch (e) {
      if (!live.current) return;
      buzzBad();
      if (e.code === 'ATTENDANCE_CLOSED') { await refresh(); release(); return; } // shows the "closed" box
      setPopup(e.code === 'NOT_IN_CLASS' ? { kind: 'add', s } : { kind: 'error', text: e.message });
    } finally {
      if (live.current) setChecking(false);
    }
  }, [id, marked, release, refresh]);

  const addAndMark = async () => {
    setAdding(true);
    setAddErr('');
    try {
      const r = await scanStudent(id, popup.s, { add: true });
      buzzOk();
      marked(r);
      closePopup();
    } catch (e) {
      if (live.current) setAddErr(e.message);
    } finally {
      if (live.current) setAdding(false);
    }
  };

  const reopen = async () => {
    setReopening(true);
    try { const c = await reopenAttendance(id); if (live.current) setCls(c); }
    catch (e) { if (live.current) setPopup({ kind: 'error', text: e.message }); }
    finally { if (live.current) setReopening(false); }
  };

  // dev helper (fake-data mode only): simulators have no camera. Scans the next absent student;
  // when everyone is in, scans a student who is not in the class (to try the "add them?" popup).
  const simulate = () => {
    const next = cls?.students.find((x) => x.status === 'Absent');
    const s = next || { studentId: `0000${Math.floor(2000 + Math.random() * 7999)}`, name: 'New Student', dept: 'CCS', course: 'BSIT' };
    last.current = { data: '', t: 0 };
    handle(makeStudentQr(s));
  };

  // ---------- camera permission ----------
  if (!perm) return <View style={S.screen} />;
  if (!perm.granted) {
    return (
      <View style={[S.screen, S.center, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Icon n="qr" size={sc(56)} color={C.orange} />
        <Txt style={S.permText}>{L.permText}</Txt>
        <Btn variant="small" title={perm.canAskAgain ? L.allow : L.openSettings} onPress={perm.canAskAgain ? askPerm : () => Linking.openSettings()} />
        <Btn variant="ghostSm" title={L.back} onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
      </View>
    );
  }

  // the box: as big as fits between the top bar and the bottom panel (max 360)
  const box = area ? Math.floor(Math.min(area.w * 0.78, area.h * 0.9, 360)) : 0;
  const closed = !!cls?.session?.closed;
  const scanning = focused && !popup && !closed;
  const total = cls?.students.length ?? 0;
  const tint = result ? (result.already ? C.grey : statusTint[result.student.status] || C.green) : null;

  return (
    <View style={S.screen}>
      {focused && !camErr && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? ({ data }) => handle(data) : undefined}
          onMountError={() => setCamErr(true)}
        />
      )}

      {/* ---- top bar ---- */}
      <View style={[S.top, { paddingTop: insets.top + 10 }]}>
        <View style={S.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={S.round} accessibilityLabel="Back">
            <Icon n="back" size={22} color="#fff" />
          </Pressable>
          <View style={S.topText}>
            <Txt style={S.title} numberOfLines={1}>{L.title}</Txt>
            {!!cls && <Txt style={S.sub} numberOfLines={1}>{T.dashboard.classTitle(cls)}</Txt>}
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} hitSlop={12} style={[S.round, torch && S.roundOn]} accessibilityLabel="Flashlight" accessibilityState={{ checked: torch }}>
            <Icon n="flash" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={S.dateRow}>
          <View style={S.datePill}>
            <Icon n="cal" size={14} color="#fff" />
            <Txt style={S.dateText} accessibilityRole="header">{L.date(date)}</Txt>
          </View>
          {!!cls && <Txt style={S.count}>{L.present(presentCount(cls.students), total)}  •  {L.lateAfter(lateAfterTime(cls))}</Txt>}
          {pending > 0 && <View style={S.pendingPill}><Icon n="cloudOff" size={13} color="#fff" /><Txt style={S.pendingText}>{L.pending(pending)}</Txt></View>}
        </View>
      </View>

      {/* ---- the scanning box (dark around it) ---- */}
      <View style={S.middle} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <View style={S.dim} />
        <View style={{ flexDirection: 'row', height: box }}>
          <View style={S.dim} />
          <View style={{ width: box, height: box }}>
            {[S.tl, S.tr, S.bl, S.br].map((s, i) => <View key={i} style={[S.corner, s]} />)}
            {camErr && <Txt style={S.camErr}>{L.camError}</Txt>}
            {closed && (
              <View style={S.closedBox}>
                <Icon n="lock" size={sc(34)} color="#fff" />
                <Txt style={S.closedTitle}>{L.closedTitle}</Txt>
                <Txt style={S.closedBody}>{L.closedBody}</Txt>
                <Btn variant="small" title={reopening ? '…' : L.reopen} onPress={reopen} disabled={reopening} />
              </View>
            )}
          </View>
          <View style={S.dim} />
        </View>
        <View style={[S.dim, S.hintWrap]}>
          <Txt style={S.hint}>{checking ? L.checking : L.hint}</Txt>
        </View>
      </View>

      {/* ---- bottom panel ---- */}
      <View style={[S.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <View style={S.bottomInner}>
          {result && (
            <View style={[S.result, { borderLeftColor: tint }]} accessibilityLiveRegion="polite">
              <View style={{ flex: 1 }}>
                <Txt style={S.resultName} numberOfLines={1}>{result.already ? L.already(result.student) : result.student.name}</Txt>
                <Txt style={S.resultMeta} numberOfLines={1}>
                  {[maskId(result.student.studentId), result.student.dept, result.student.course].filter(Boolean).join('  •  ')}
                </Txt>
                {result.offline && <Txt style={S.offline}>{L.savedOffline}</Txt>}
                {!!result.student.conflict && <Txt style={S.offline}>{L.proxy({ ...result.student.conflict, time: fmtTime(result.student.conflict.time) })}</Txt>}
              </View>
              {!result.already && <View style={[S.chip, { backgroundColor: tint }]}><Txt style={S.chipText}>{result.student.status}</Txt></View>}
            </View>
          )}
          <View style={S.actions}>
            {USE_MOCK && <Btn variant="ghostSm" title={L.simulate} onPress={simulate} style={S.simBtn} />}
            <Btn variant="small" title={L.done(count)} icon={<Icon n="arrow" size={14} color="#fff" />} onPress={() => navigation.goBack()} />
          </View>
        </View>
      </View>

      {/* ---- popups ---- */}
      {popup?.kind === 'wrong' && (
        <Dialog title={L.wrongTitle} onClose={closePopup}>
          <Txt style={S.body}>{L.wrongBody}</Txt>
          <DialogActions>
            <Btn variant="solid" title={L.tryAgain} onPress={closePopup} />
          </DialogActions>
        </Dialog>
      )}

      {popup?.kind === 'add' && (
        <Dialog title={L.notInClass} onClose={adding ? () => {} : closePopup}>
          <View style={S.card}>
            <Txt style={S.cardName}>{popup.s.name}</Txt>
            <Txt style={S.body}>{L.idLbl}: {maskId(popup.s.studentId)}</Txt>
            <Txt style={S.body}>{L.deptLbl}: {popup.s.dept}</Txt>
            <Txt style={S.body}>{L.courseLbl}: {popup.s.course}</Txt>
          </View>
          {!!addErr && <Txt style={S.err} accessibilityRole="alert">{addErr}</Txt>}
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={closePopup} disabled={adding} />
            <Btn variant="solid" title={adding ? L.adding : L.add} onPress={addAndMark} disabled={adding} />
          </DialogActions>
        </Dialog>
      )}

      {popup?.kind === 'error' && (
        <Dialog title={L.errTitle} onClose={closePopup}>
          <Txt style={S.body}>{popup.text}</Txt>
          <DialogActions>
            <Btn variant="solid" title={L.ok} onPress={closePopup} />
          </DialogActions>
        </Dialog>
      )}
    </View>
  );
}

const ARM = 34, BORDER = 4;
const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.cream },
  permText: { textAlign: 'center', marginBottom: 6, maxWidth: 360 },

  top: { backgroundColor: DIM, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  round: { width: sc(40), height: sc(40), borderRadius: sc(20), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: C.orange },
  topText: { flex: 1, alignItems: 'center' },
  title: { fontFamily: F.semi, fontSize: FS.scanTitle, color: '#fff' },
  sub: { fontSize: FS.md, color: '#ffffffcc', marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orange, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  dateText: { fontFamily: F.semi, fontSize: FS.md, color: '#fff' },
  count: { fontSize: FS.md, color: '#fff' },

  middle: { flex: 1 },
  dim: { flex: 1, backgroundColor: DIM },
  hintWrap: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 14, paddingHorizontal: 16 },
  hint: { color: '#fff', fontSize: FS.md, textAlign: 'center' },
  corner: { position: 'absolute', width: ARM, height: ARM, borderColor: C.orange },
  tl: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 10 },
  camErr: { color: '#fff', textAlign: 'center', fontSize: FS.md, margin: 24, marginTop: '40%' },

  bottom: { backgroundColor: DIM, paddingHorizontal: 16, paddingTop: 12 },
  bottomInner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', gap: 12 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.cream, borderRadius: 8, borderLeftWidth: 5, paddingVertical: 10, paddingHorizontal: 12 },
  resultName: { fontFamily: F.semi, fontSize: FS.base },
  resultMeta: { fontSize: FS.sm, color: C.muted, marginTop: 2 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipText: { fontFamily: F.semi, fontSize: FS.sm, color: '#fff' },
  offline: { fontSize: FS.sm, color: C.amber, marginTop: 2 },
  pendingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.amber, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  pendingText: { fontSize: FS.sm, color: '#fff' },
  closedBox: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  closedTitle: { fontFamily: F.semi, fontSize: FS.base, color: '#fff', textAlign: 'center' },
  closedBody: { fontSize: FS.sm, color: '#ffffffcc', textAlign: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  simBtn: { backgroundColor: C.cream, borderRadius: 6 },

  body: { fontSize: FS.md },
  card: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, padding: 12, gap: 3 },
  cardName: { fontFamily: F.semi, fontSize: FS.base, marginBottom: 2 },
  err: { color: C.red, fontSize: FS.md },
});
