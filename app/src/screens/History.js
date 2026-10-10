// ATTENDANCE HISTORY (one class): every day attendance was taken in a range, with counts.
// Tap a day -> the class page opens on that day (read it, correct a status).
// Export -> a .csv file (opens in Excel / Google Sheets) shared through the phone's share menu.
//   texts -> src/content.js (T.history) | spreadsheet layout -> attendanceXlsx in src/xlsx.js
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import Btn from '../components/Btn';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import { getClass, getHistory, ranges } from '../api/classApi';
import { attendanceXlsx, xlsxName } from '../xlsx';
import { shareXlsx } from '../share';
import { T } from '../content';
import { fmtDay, fmtTime } from '../utils';
import { C, F, FS, column } from '../theme';

const ORDER = ['week', 'month', 'd30', 'year'];

export default function History({ route, navigation }) {
  const L = T.history;
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('d30');
  const [cls, setCls] = useState(null);
  const [h, setH] = useState(null);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    setH(null);
    const [from, to] = ranges()[range];
    Promise.all([getClass(id), getHistory(id, from, to)])
      .then(([c, hist]) => { if (live) { setCls(c); setH(hist); setErr(''); } })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [id, range]));

  const exportCsv = async () => {
    setExporting(true);
    setErr('');
    try {
      await shareXlsx(xlsxName(cls, h), attendanceXlsx(cls, h), L.shareTitle);
    } catch (e) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  };

  const days = h ? [...h.dates].reverse() : []; // newest first
  const top = (
    <View style={S.head}>
      {!!cls && (
        <View>
          <Txt style={S.cls} numberOfLines={2}>{cls.course}</Txt>
          <Txt style={S.clsSub}>{T.dashboard.classTitle(cls)}</Txt>
        </View>
      )}
      <View style={S.chips}>
        {ORDER.map((k) => (
          <Pressable key={k} onPress={() => setRange(k)} style={[S.chip, range === k && S.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: range === k }}>
            <Txt style={[S.chipText, range === k && S.chipTextOn]}>{L.ranges[k]}</Txt>
          </Pressable>
        ))}
      </View>
      {!!h && <Txt style={S.muted}>{L.days(h.dates.length)}</Txt>}
      {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header title={L.title} />
      <FlatList
        data={days}
        keyExtractor={(d) => d.date}
        ListHeaderComponent={top}
        ListEmptyComponent={<Txt style={S.empty}>{h ? L.none : L.loading}</Txt>}
        renderItem={({ item: d }) => (
          <Pressable style={({ pressed }) => [S.day, pressed && { opacity: 0.7 }]} onPress={() => navigation.popTo('ClassDetail', { id, date: d.date, at: Date.now() })} accessibilityRole="button">
            <View style={{ flex: 1, gap: 3 }}>
              <Txt style={S.date}>{fmtDay(d.date)}</Txt>
              <Txt style={S.counts}>{L.counts(d)}</Txt>
              {d.adjusted && <Txt style={S.started}>{L.started(fmtTime(d.startTime))}</Txt>}
            </View>
            <Txt style={S.big}>{d.present + d.late}/{d.total}</Txt>
            <Icon n="chevR" size={16} />
          </Pressable>
        )}
        contentContainerStyle={[column, { padding: 16, paddingBottom: insets.bottom + 100 }]}
      />
      <View style={[S.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Btn variant="pill" title={exporting ? L.exporting : L.export} icon={!exporting && <Icon n="download" size={16} color="#fff" />}
          onPress={exportCsv} disabled={exporting || !h || !h.dates.length} />
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  head: { gap: 10, marginBottom: 10 },
  cls: { fontFamily: F.semi, fontSize: FS.base },
  clsSub: { fontSize: FS.sm, color: C.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.paper },
  chipOn: { backgroundColor: C.orange, borderColor: C.orange },
  chipText: { fontSize: FS.md },
  chipTextOn: { color: '#fff', fontFamily: F.semi },
  muted: { fontSize: FS.sm, color: C.muted },
  err: { color: C.red, fontSize: FS.md },
  empty: { textAlign: 'center', padding: 30, color: C.muted },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: C.paper },
  date: { fontFamily: F.semi, fontSize: FS.base },
  counts: { fontSize: FS.sm, color: C.muted },
  started: { fontSize: FS.sm, color: C.amber },
  big: { fontFamily: F.bold, fontSize: FS.lg },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, backgroundColor: C.cream + 'ee', alignItems: 'center' },
});
