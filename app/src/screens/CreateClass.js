// CREATE CLASS
//   texts  -> src/content.js  (T.createClass)
//   title bar -> src/components/Header.js | days dropdown -> DaysPicker.js | time popup -> TimeField.js
//   fonts/sizes -> src/theme.js (pageTitle = "Create Class", sm = field labels, md = inputs)
//   "Non-uniform time" ticked -> one start/end per picked day (Monday: start/end, Wednesday: start/end, ...)
//   EDIT CLASS uses this same screen: navigation.navigate('EditClass', { id }) -> filled in, Save goes back.
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import Plain from '../components/Plain';
import DaysPicker from '../components/DaysPicker';
import TimeField from '../components/TimeField';
import GracePicker from '../components/GracePicker';
import Btn from '../components/Btn';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { createClass, getClass, updateClass } from '../api/classApi';
import { T } from '../content';
import { clean, minToTime } from '../utils';
import { C, F, FS, column } from '../theme';
import { DAYS, LATE_AFTER_MIN } from '../constants';

const blank = { course: '', code: '', section: '', days: [], startTime: '', endTime: '', lateAfter: LATE_AFTER_MIN };

// "08:30" -> "09:30" (where the End time popup starts), never past 11:59 pm
const hourAfter = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return minToTime(Math.min(h * 60 + m + 60, 23 * 60 + 59));
};

// start + end time side by side. label = the day name, shown in the time popup's title ("Monday: Start time")
function TimeRow({ value = {}, onChange, label }) {
  const L = T.createClass;
  return (
    <View style={S.row2}>
      <View style={{ flex: 1 }}><Plain label={L.start}><TimeField title={label ? `${label}: ${L.startTitle}` : L.startTitle} value={value.startTime} onChange={(t) => onChange({ ...value, startTime: t })} /></Plain></View>
      <View style={{ flex: 1 }}><Plain label={L.end}><TimeField title={label ? `${label}: ${L.endTitle}` : L.endTitle} value={value.endTime} suggest={hourAfter(value.startTime)} onChange={(t) => onChange({ ...value, endTime: t })} /></Plain></View>
    </View>
  );
}

export default function CreateClass({ navigation, route }) {
  const L = T.createClass;
  const editId = route?.params?.id; // set = editing that class
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false); // keyboard open -> the bottom bar hides so it never covers a field
  const [loaded, setLoaded] = useState(!editId);
  const [f, setF] = useState(blank);
  const [perDay, setPerDay] = useState(false);  // "Non-uniform time" ticked
  const [times, setTimes] = useState({});       // { Monday: { startTime, endTime }, ... } (kept if a day is unticked and ticked again)
  const { busy, err, setErr, run } = useSubmit();
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const days = DAYS.filter((d) => f.days.includes(d)); // picked days in week order

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // editing: fill the form with the class as it is now
  useEffect(() => {
    if (!editId) return;
    getClass(editId).then((c) => {
      const per = c.times?.length > 0;
      // a class with a time per day shows today's times as startTime/endTime, so use the first day's for "uniform"
      const first = per ? c.times[0] : c;
      setF({ course: c.course, code: c.code, section: c.section, days: c.days, startTime: first.startTime, endTime: first.endTime, lateAfter: c.lateAfter });
      setPerDay(per);
      setTimes(Object.fromEntries((c.times || []).map((t) => [t.day, { startTime: t.startTime, endTime: t.endTime }])));
      setLoaded(true);
    }).catch((e) => setErr(e.message));
  }, [editId]);

  const submit = () => {
    const v = clean(f);
    if (!v.days.length || [v.course, v.code, v.section].some((x) => !x)) return setErr(L.errEmpty);
    if (perDay) {
      const list = days.map((day) => ({ day, startTime: times[day]?.startTime || '', endTime: times[day]?.endTime || '' }));
      const missing = list.find((t) => !t.startTime || !t.endTime);
      if (missing) return setErr(L.errDayTime(missing.day));
      const bad = list.find((t) => t.endTime <= t.startTime);
      if (bad) return setErr(L.errDayOrder(bad.day));
      // the class times = the first day's (used on a day that isn't in the list)
      Object.assign(v, { times: list, startTime: list[0].startTime, endTime: list[0].endTime });
    } else {
      if (!v.startTime || !v.endTime) return setErr(L.errEmpty);
      if (v.endTime <= v.startTime) return setErr(L.errTime);
      v.times = [];
    }
    run(async () => {
      if (editId) {
        await updateClass(editId, v);
        navigation.goBack(); // the class page reloads when it comes back into view
      } else {
        const c = await createClass(v);
        navigation.replace('ClassDetail', { id: c._id });
      }
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={editId ? L.editTitle : L.title} />
      {!loaded ? <Txt style={S.loading}>{err || L.loading}</Txt> : (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[S.form, column, { paddingBottom: BAR_ROOM }]}>
          <Plain label={L.course} placeholder={L.coursePh} value={f.course} onChangeText={set('course')} maxLength={40} />
          <Plain label={L.code} placeholder={L.codePh} value={f.code} onChangeText={set('code')} maxLength={40} autoCapitalize="characters" />
          <Plain label={L.section} placeholder={L.sectionPh} value={f.section} onChangeText={set('section')} maxLength={40} />

          <Pressable style={S.check} onPress={() => { setPerDay(!perDay); setErr(''); }} hitSlop={6}
            accessibilityRole="checkbox" accessibilityState={{ checked: perDay }} accessibilityLabel={L.perDay} accessibilityHint={L.perDayHint}>
            <View style={[S.box, perDay && S.boxOn]}>{perDay && <Icon n="check" size={12} color="#fff" />}</View>
            <View style={{ flex: 1 }}>
              <Txt style={S.checkText}>{L.perDay}</Txt>
              <Txt style={S.hint}>{L.perDayHint}</Txt>
            </View>
          </Pressable>

          <Plain label={L.days}><DaysPicker value={f.days} onChange={set('days')} /></Plain>

          {!perDay ? (
            <TimeRow value={{ startTime: f.startTime, endTime: f.endTime }} onChange={(t) => setF((p) => ({ ...p, ...t }))} />
          ) : days.length ? (
            days.map((day) => (
              <View key={day} style={S.day}>
                <Txt style={S.dayName}>{day}</Txt>
                <TimeRow label={day} value={times[day]} onChange={(t) => setTimes((p) => ({ ...p, [day]: t }))} />
              </View>
            ))
          ) : (
            <Txt style={S.hint}>{L.perDayPick}</Txt>
          )}

          <Plain label={L.grace}>
            <GracePicker value={f.lateAfter} onChange={set('lateAfter')} />
            <Txt style={{ fontSize: FS.sm, color: C.muted }}>{L.graceHint}</Txt>
          </Plain>
        </ScrollView>
      </KeyboardAvoidingView>
      )}

      {/* Done / Save stays at the bottom while scrolling: a slim bar under the form (the form's last field can
          scroll up above it), hidden while the keyboard is open */}
      {loaded && !typing && (
        <View style={[S.bar, { paddingBottom: insets.bottom + 10 }]}>
          {!!err && <Txt style={S.err} accessibilityRole="alert" numberOfLines={2}>{err}</Txt>}
          <Btn variant="small" title={busy ? L.busy : editId ? L.save : L.done} icon={!busy && <Icon n="arrow" size={14} color="#fff" />} onPress={submit} disabled={busy} />
        </View>
      )}
    </View>
  );
}

const BAR_ROOM = 24; // extra space under the last field, so it isn't tight against the bar

const S = StyleSheet.create({
  form: { padding: 16, paddingTop: 18, gap: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  box: { width: 20, height: 20, borderWidth: 1.5, borderColor: C.orange, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  boxOn: { backgroundColor: C.orange },
  checkText: { fontSize: FS.md, fontFamily: F.medium },
  hint: { fontSize: FS.sm, color: C.muted },
  day: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  dayName: { fontFamily: F.semi, fontSize: FS.md, color: C.orange },
  loading: { textAlign: 'center', padding: 30, color: C.muted },
  bar: { paddingTop: 10, paddingHorizontal: 16, gap: 6, backgroundColor: C.cream, borderTopWidth: 1.5, borderTopColor: C.line, alignItems: 'center' },
  err: { color: C.red, fontSize: FS.md, textAlign: 'center' },
});
