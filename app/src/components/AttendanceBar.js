import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Btn from './Btn';
import Dialog, { DialogActions } from './Dialog';
import GracePicker from './GracePicker';
import Icon from './Icon';
import Txt from './Txt';
import { closeAttendance, reopenAttendance, resetStart, startAttendance, updateClass } from '../api/classApi';
import { T } from '../content';
import { classEnded, fmtTime, lateAfterTime, nowMin, startToday } from '../utils';
import { C, FS } from '../theme';

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };

// Today's attendance controls on the class page:
//   "Late after 1:15 pm" (tap to change the grace minutes) + Start attendance now / Use schedule
//   Close attendance / Reopen
// act(promise) puts the updated class on screen (or shows the error).
export default function AttendanceBar({ cls, act }) {
  const L = T.classDetail;
  const [busy, setBusy] = useState('');       // which button is working
  const [dialog, setDialog] = useState(null); // 'grace' | 'close'
  const [grace, setGrace] = useState(cls.lateAfter);
  const s = cls.session || {};

  const run = (key, fn) => async () => {
    setBusy(key);
    try { await act(fn()); } finally { setBusy(''); setDialog(null); }
  };
  const canStart = !s.closed && !classEnded(cls) && nowMin() > toMin(cls.startTime);

  return (
    <View style={S.wrap}>
      <View style={S.row}>
        <Icon n={s.adjusted ? 'play' : 'clock'} size={14} />
        <Pressable onPress={() => { setGrace(cls.lateAfter); setDialog('grace'); }} hitSlop={6} style={S.grow} accessibilityRole="button" accessibilityHint={L.graceTitle}>
          {/* two lines on every phone: "Attendance started at ..." then "Late after ..." under it */}
          {s.adjusted && <Txt style={S.text}>{L.startedAt(fmtTime(startToday(cls)))}</Txt>}
          <Txt style={[S.text, S.link, s.adjusted && S.under]}>{L.lateAfter(lateAfterTime(cls))}</Txt>
        </Pressable>
        {s.adjusted ? (
          <Pressable onPress={run('reset', () => resetStart(cls._id))} hitSlop={8} accessibilityRole="button"><Txt style={[S.text, S.link]}>{L.reset}</Txt></Pressable>
        ) : canStart ? (
          <Btn variant="ghostSm" title={busy === 'start' ? L.startBusy : L.start} onPress={run('start', () => startAttendance(cls._id))} disabled={!!busy} />
        ) : null}
      </View>

      <View style={S.row}>
        {s.closed && <Icon n="lock" size={14} color={C.red} />}
        <Txt style={[S.text, S.grow, s.closed && { color: C.red }]}>
          {s.closed ? (s.closedTime ? L.closedAt(fmtTime(s.closedTime)) : L.closed) : ''}
        </Txt>
        {s.closed ? (
          <Btn variant="ghostSm" title={L.reopen} onPress={run('reopen', () => reopenAttendance(cls._id))} disabled={!!busy} />
        ) : (
          <Btn variant="ghostSm" title={L.close} onPress={() => setDialog('close')} disabled={!!busy} />
        )}
      </View>

      {dialog === 'close' && (
        <Dialog title={L.closeTitle} onClose={() => setDialog(null)}>
          <Txt style={{ fontSize: FS.md }}>{L.closeBody}</Txt>
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={() => setDialog(null)} />
            <Btn variant="danger" title={busy ? '…' : L.close} onPress={run('close', () => closeAttendance(cls._id))} disabled={!!busy} />
          </DialogActions>
        </Dialog>
      )}

      {dialog === 'grace' && (
        <Dialog title={L.graceTitle} onClose={() => setDialog(null)}>
          <Txt style={{ fontSize: FS.md }}>{L.graceBody(fmtTime(startToday(cls)))}</Txt>
          <GracePicker value={grace} onChange={setGrace} />
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={() => setDialog(null)} />
            <Btn variant="solid" title={busy ? '…' : L.save} onPress={run('grace', () => updateClass(cls._id, { lateAfter: grace }))} disabled={!!busy} />
          </DialogActions>
        </Dialog>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { paddingVertical: 8, gap: 16, borderBottomWidth: 1.5, borderBottomColor: C.line }, // gap = space between the schedule row and Close attendance
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 34 },
  grow: { flexGrow: 1, flexShrink: 1 },
  text: { fontSize: FS.sm },
  link: { color: C.orange, textDecorationLine: 'underline' },
  under: { marginTop: 4 }, // space between "Attendance started at" and "Late after"
});
