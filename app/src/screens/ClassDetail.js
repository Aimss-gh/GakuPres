// CLASS DETAIL (banner + day picker + attendance controls + student table)
//   texts  -> src/content.js  (T.classDetail, T.dashboard.classTitle)
//   fonts/sizes -> src/theme.js (banner = course name, md = banner subtitle, sm = table + date)
//   table rows -> src/components/StudentRow.js | add-student popup -> AddStudentModal.js | import -> ImportModal.js
//   today's controls (late after / start / close) -> src/components/AttendanceBar.js
//   ‹ › walk through past days (read the record, correct a status); History opens the list + export.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import Ring from '../components/Ring';
import Txt from '../components/Txt';
import Btn from '../components/Btn';
import Dialog, { DialogActions } from '../components/Dialog';
import StudentRow, { COL } from '../components/StudentRow';
import AddStudentModal from '../components/AddStudentModal';
import ImportModal from '../components/ImportModal';
import { classListCsv, classListName } from '../csv';
import { shareCsv } from '../share';
import AttendanceBar from '../components/AttendanceBar';
import { getClass, setStatus, removeStudent, addStudent, deleteClass, startAttendance } from '../api/classApi';
import { flushScans, onQueueChange, pendingScans } from '../api/offline';
import { USE_MOCK } from '../api/http';
import { addDays, fmtDay, fmtTime, localDate, localTime, presentCount, runningLate, schedule } from '../utils';
import { T } from '../content';
import { C, F, FS, column, fabRight } from '../theme';

export default function ClassDetail({ route, navigation }) {
  const L = T.classDetail;
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // room left of the class-list button: screen - right margin - (scan 52 - mini 40)/2 - mini - gap - 16 left gutter
  const popW = Math.max(0, width - fabRight(width) - 6 - 40 - POP_GAP - 16);
  const [date, setDate] = useState(route.params.date || localDate()); // the day on screen
  const [cls, setCls] = useState(null);
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState(null); // 'add' | 'import' | 'delete' | 'late' | null
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(0);
  const [starting, setStarting] = useState(false);
  const [fileMenu, setFileMenu] = useState(false); // the Import / Export buttons popped out
  const today = localDate();
  const isToday = date === today;
  const dateArg = isToday ? undefined : date;

  // History screen opens a day with popTo('ClassDetail', { id, date, at })  (at = a new number each time)
  useEffect(() => { if (route.params.date) { setEditing(false); setDate(route.params.date); } }, [route.params.date, route.params.at]);

  const load = useCallback(async (live = { current: true }) => {
    try {
      const c = await getClass(id, dateArg);
      if (live.current) { setCls(c); setErr(''); }
    } catch (e) {
      if (live.current) setErr(e.message);
    }
  }, [id, dateArg]);

  // reload when we come back from the scanner / History, and send scans saved offline
  useFocusEffect(useCallback(() => {
    const live = { current: true };
    load(live);
    if (!USE_MOCK) {
      flushScans().then(({ sent, dropped }) => {
        if (!live.current) return;
        if (sent) load(live);
        if (dropped.length) setNote(L.dropped(dropped.length, dropped[0].message));
      }).catch(() => {});
      pendingScans(id).then((l) => live.current && setPending(l.length));
    }
    return () => { live.current = false; };
  }, [load, id]));
  useEffect(() => (USE_MOCK ? undefined : onQueueChange((list) => setPending(list.filter((x) => x.classId === id).length))), [id]);

  // every api call returns the updated class -> just put it in state
  const apply = useCallback(async (promise) => {
    try { setCls(await promise); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  const onStatus = useCallback((sid, st) => apply(setStatus(id, sid, st, dateArg)), [id, apply, dateArg]);
  const onRemove = useCallback((sid) => apply(removeStudent(id, sid, dateArg)), [id, apply, dateArg]);
  const closeModal = useCallback(() => setModal(null), []);
  const present = useMemo(() => (cls ? presentCount(cls.students) : 0), [cls]);

  const goDay = (d) => { setEditing(false); setDate(d); };
  const openScanner = () => navigation.navigate('QRScan', { id });
  // opening the scanner after the late mark without having started -> ask "Running late?"
  const onScanPress = () => (runningLate(cls) ? setModal('late') : openScanner());
  const startNow = async () => {
    setStarting(true);
    try { setCls(await startAttendance(id)); setErr(''); return true; }
    catch (e) { setErr(e.message); return false; }
    finally { setStarting(false); }
  };
  // class list as a .csv (same columns the import reads)
  const exportList = async () => {
    setFileMenu(false);
    try { await shareCsv(classListName(cls), classListCsv(cls), L.exportTitle); }
    catch (e) { setErr(e.message); }
  };

  const uploadNow = async () => {
    const { sent, dropped } = await flushScans();
    if (dropped.length) setNote(L.dropped(dropped.length, dropped[0].message));
    if (sent) load();
  };

  const confirmDelete = async () => {
    try { await deleteClass(id); navigation.popToTop(); }
    catch (e) { setErr(e.message); setModal(null); }
  };

  if (!cls) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={[S.top, column, { paddingHorizontal: 16 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back"><Icon n="back" size={26} /></Pressable>
        </View>
        <Txt style={[S.center, !!err && { color: C.red }]}>{err || T.dashboard.loading}</Txt>
      </View>
    );
  }
  const showing = cls.date === date; // false for a moment while another day loads

  const header = (
    <View>
      <View style={S.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back"><Icon n="back" size={26} /></Pressable>
        <View style={S.topRight}>
          <Pressable onPress={() => navigation.navigate('EditClass', { id })} hitSlop={10} style={S.topBtn} accessibilityRole="button" accessibilityLabel={L.edit}>
            <Icon n="edit" size={17} /><Txt style={S.topBtnText}>{L.edit}</Txt>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('History', { id })} hitSlop={10} style={S.topBtn} accessibilityRole="button" accessibilityLabel={L.history}>
            <Icon n="list" size={18} /><Txt style={S.topBtnText}>{L.history}</Txt>
          </Pressable>
          <Pressable onPress={() => setModal('delete')} hitSlop={12} accessibilityLabel="Delete class"><Icon n="trash" size={20} color={C.red} /></Pressable>
        </View>
      </View>
      <View style={S.banner}>
        <Txt style={S.bannerTitle} numberOfLines={2}>{cls.course}</Txt>
        <Txt style={S.bannerSub}>{T.dashboard.classTitle(cls)}</Txt>
      </View>

      {/* schedule + ‹ day › */}
      <View style={S.meta}>
        <View style={{ gap: 6, flex: 1 }}>
          <View style={[S.metaRow, S.metaTop]}><Icon n="clock" size={13} style={S.metaIcon} /><Txt style={[S.metaText, { flex: 1 }]}>{schedule(cls)}</Txt></View>
          <View style={S.dayRow}>
            <Pressable onPress={() => goDay(addDays(date, -1))} hitSlop={10} style={S.dayBtn} accessibilityLabel="Previous day"><Icon n="chevL" size={16} /></Pressable>
            <Txt style={[S.metaText, S.dayText]} numberOfLines={1}>{isToday ? `${L.today}, ` : ''}{fmtDay(date)}</Txt>
            <Pressable onPress={() => goDay(addDays(date, 1))} hitSlop={10} disabled={isToday} style={[S.dayBtn, isToday && { opacity: 0.3 }]} accessibilityLabel="Next day"><Icon n="chevR" size={16} /></Pressable>
            {!isToday && <Pressable onPress={() => goDay(today)} hitSlop={8} accessibilityRole="button"><Txt style={S.link}>{L.today}</Txt></Pressable>}
          </View>
        </View>
        <Ring done={showing ? present : 0} total={cls.students.length} />
      </View>

      {cls.offline && <Txt style={S.warn}>{L.offline}</Txt>}
      {pending > 0 && (
        <View style={S.pendingRow}>
          <Txt style={[S.warn, { flex: 1 }]}>{L.pending(pending)}</Txt>
          <Btn variant="ghostSm" title={L.uploadNow} onPress={uploadNow} />
        </View>
      )}
      {!!note && <Txt style={S.warn} onPress={() => setNote('')}>{note}</Txt>}
      {isToday
        ? showing && !cls.offline && <AttendanceBar key={`${cls._id}-${cls.lateAfter}`} cls={cls} act={apply} />
        : <Txt style={S.pastNote}>{L.pastNote}</Txt>}
      {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
      {showing && cls.students.some((s) => s.conflict) && <Txt style={S.warn}>{L.proxyLegend}</Txt>}
      <View style={S.thead}>
        <Txt style={[S.th, COL.name]}>{L.colName}</Txt>
        <Txt style={[S.th, COL.id]}>{L.colId}</Txt>
        <Txt style={[S.th, COL.course]}>{L.colCourse}</Txt>
        <View style={COL.status}>
          <Txt style={S.th}>{L.colStatus}</Txt>
          <Pressable onPress={() => setEditing(!editing)} style={editing && S.editOn} hitSlop={8} accessibilityLabel="Edit statuses"><Icon n="edit" size={14} color={C.red} /></Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <FlatList
        data={showing ? cls.students : []}
        keyExtractor={(s) => s._id}
        extraData={editing}
        ListHeaderComponent={header}
        ListEmptyComponent={<Txt style={S.empty}>{showing ? L.noStudents : T.dashboard.loading}</Txt>}
        renderItem={({ item, index }) => <StudentRow stu={item} n={index + 1} editing={editing && !cls.offline} onStatus={onStatus} onRemove={onRemove} />}
        contentContainerStyle={[column, { paddingHorizontal: 16, paddingBottom: insets.bottom + 170 }]}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[S.fabs, { bottom: insets.bottom + 22, right: fabRight(width) }]}>
        {/* class list: tap -> Import / Export pop out to the left */}
        <View>
          {fileMenu && (
            // A strip with a real width that ends POP_GAP left of the X, buttons pushed to its right end.
            // (With only `right` set, Android squeezed it to the X's 40px and the buttons spilled onto the X.)
            <View style={[S.pop, { width: popW }]} pointerEvents="box-none">
              <Pressable style={S.popBtn} onPress={() => { setFileMenu(false); setModal('import'); }} accessibilityRole="button" accessibilityLabel={L.importList}>
                <Icon n="upload" size={14} color="#fff" /><Txt style={S.popText} numberOfLines={1}>{L.importBtn}</Txt>
              </Pressable>
              <Pressable style={[S.popBtn, !cls.students.length && { opacity: 0.5 }]} onPress={exportList} disabled={!cls.students.length} accessibilityRole="button" accessibilityLabel={L.exportTitle}>
                <Icon n="download" size={14} color="#fff" /><Txt style={S.popText} numberOfLines={1}>{L.exportBtn}</Txt>
              </Pressable>
            </View>
          )}
          <Pressable style={[S.mini, fileMenu && S.miniOn]} onPress={() => setFileMenu((v) => !v)} accessibilityLabel={L.classList} accessibilityState={{ expanded: fileMenu }}>
            <Icon n={fileMenu ? 'x' : 'file'} size={16} color={fileMenu ? '#fff' : C.orange} />
          </Pressable>
        </View>
        <Pressable style={S.mini} onPress={() => setModal('add')} accessibilityLabel={L.addOne}><Icon n="userPlus" size={16} /></Pressable>
        {isToday && <Pressable style={S.square} onPress={onScanPress} accessibilityLabel="Scan student IDs"><Icon n="qr" size={26} /></Pressable>}
      </View>

      {modal === 'add' && <AddStudentModal onAdd={async (s) => { await addStudent(id, s); await load(); }} onClose={closeModal} />}
      {modal === 'import' && <ImportModal classId={id} onDone={() => load()} onClose={closeModal} />}
      {modal === 'late' && (
        <Dialog title={L.lateTitle} onClose={closeModal}>
          <Txt style={{ fontSize: FS.md }}>{L.lateBody(fmtTime(cls.startTime), fmtTime(localTime()))}</Txt>
          <DialogActions>
            <Btn variant="ghostSm" title={L.lateNo} onPress={() => { closeModal(); openScanner(); }} />
            <Btn variant="solid" title={starting ? L.startBusy : L.lateYes} disabled={starting}
              onPress={async () => { const ok = await startNow(); closeModal(); if (ok) openScanner(); }} />
          </DialogActions>
        </Dialog>
      )}
      {modal === 'delete' && (
        <Dialog title={L.deleteTitle} onClose={closeModal}>
          <Txt style={{ fontSize: FS.md }}>{L.deleteBody(cls)}</Txt>
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={closeModal} />
            <Btn variant="danger" title={L.delete} onPress={confirmDelete} />
          </DialogActions>
        </Dialog>
      )}
    </View>
  );
}

const POP_GAP = 12; // space between the Export button and the X

const S = StyleSheet.create({
  center: { textAlign: 'center', padding: 60, color: C.muted },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  topBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topBtnText: { fontSize: FS.md, color: C.orange, fontFamily: F.medium },
  banner: { backgroundColor: C.orange, borderRadius: 6, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  bannerTitle: { fontFamily: F.bold, fontSize: FS.banner, color: '#fff' },
  bannerSub: { fontSize: FS.md, color: '#ffffffd9', marginTop: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: C.line },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTop: { alignItems: 'flex-start' },
  metaIcon: { marginTop: 1 },
  metaText: { fontSize: FS.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: F.semi, flexShrink: 1 },
  link: { fontSize: FS.sm, color: C.orange, textDecorationLine: 'underline' },
  warn: { color: C.amber, fontSize: FS.sm, marginTop: 8 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastNote: { fontSize: FS.sm, color: C.muted, paddingVertical: 8, borderBottomWidth: 1.5, borderBottomColor: C.line },
  err: { color: C.red, fontSize: FS.md, marginTop: 8 },
  thead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1.5, borderBottomColor: C.line },
  th: { fontSize: FS.sm },
  editOn: { backgroundColor: '#ffd9c2', borderRadius: 4, padding: 2 },
  empty: { textAlign: 'center', padding: 30, color: C.muted },
  fabs: { position: 'absolute', alignItems: 'center', gap: 10 },
  mini: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.orange, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  miniOn: { backgroundColor: C.orange },
  pop: { position: 'absolute', right: 40 + POP_GAP, top: 0, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  popBtn: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.orange, elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  popText: { color: '#fff', fontFamily: F.semi, fontSize: FS.md, flexShrink: 1 },
  square: { width: 52, height: 52, borderRadius: 8, borderWidth: 1.5, borderColor: C.orange, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
});
