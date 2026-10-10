import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import Txt from './Txt';
import Popover, { MenuBox, MenuItem, useAnchor } from './Popover';
import { STATUSES } from '../constants';
import { T } from '../content';
import { maskId } from '../utils';
import { C, F, FS, statusColor } from '../theme';

// Column widths. The table header in ClassDetail uses the same numbers so everything lines up.
export const COL = {
  name: { flex: 2.3 },
  id: { flex: 1.5 },
  course: { flex: 1.2 },
  status: { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
};

// One row of the roster. memo() = only re-renders when ITS student changes.
function StudentRow({ stu, n, editing, onStatus, onRemove }) {
  const a = useAnchor();
  const nameTip = useAnchor(); // hold the name -> small bubble with the full name, just above the finger
  const [sub, setSub] = useState(false); // is the Present/Late/Excuse/Absent list open?
  const close = () => { setSub(false); a.close(); };

  return (
    <View style={S.row}>
      <Pressable style={COL.name} onLongPress={nameTip.openAt} delayLongPress={350}
        accessibilityHint={T.classDetail.holdName}>
        <Txt style={S.cell} numberOfLines={1}>
          {n}. {!!stu.conflict && <Txt style={[S.cell, { color: C.amber }]}>⚠ </Txt>}{stu.name}
        </Txt>
      </Pressable>
      <Txt style={[S.cell, COL.id]} numberOfLines={1}>{maskId(stu.studentId)}</Txt>
      <Txt style={[S.cell, COL.course, !stu.course && { color: C.muted }]} numberOfLines={1}>{stu.course || T.classDetail.noRecord}</Txt>
      <View style={COL.status}>
        <Txt style={[S.cell, { color: statusColor[stu.status] || C.muted }]}>{stu.status || T.classDetail.noRecord}</Txt>
        {editing && (
          <Pressable ref={a.ref} collapsable={false} onPress={a.open} hitSlop={10} accessibilityLabel="Row options"><Icon n="dots" size={16} /></Pressable>
        )}
      </View>

      <Popover pos={nameTip.pos} onClose={nameTip.close} above>
        <MenuBox style={S.tip}><Txt style={S.tipText} accessibilityRole="text">{stu.name}</Txt></MenuBox>
      </Popover>

      <Popover pos={a.pos} onClose={close}>
        {sub && (
          <MenuBox style={{ minWidth: 80 }}>
            {STATUSES.map((st) => (
              <MenuItem key={st} center label={st} selected={st === stu.status} borderColor={st === stu.status ? C.green : C.line}
                onPress={() => { close(); onStatus(stu._id, st); }} />
            ))}
          </MenuBox>
        )}
        <MenuBox>
          <View style={S.split}>
            <MenuItem center label={stu.status || T.classDetail.noRecord} borderColor={C.line} />
            <Pressable style={S.arrow} onPress={() => setSub(!sub)} accessibilityLabel="Change status"><Icon n="arrow" size={13} /></Pressable>
          </View>
          <MenuItem center label={T.classDetail.remove} color={C.red} borderColor={C.red} onPress={() => { close(); onRemove(stu._id); }} />
        </MenuBox>
      </Popover>
    </View>
  );
}
export default memo(StudentRow);

const S = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1.5, borderBottomColor: C.line },
  cell: { fontSize: FS.sm },
  split: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  arrow: { borderWidth: 1, borderColor: C.orange, borderRadius: 6, padding: 5 },
  tip: { minWidth: 0, paddingHorizontal: 10, paddingVertical: 8, flexShrink: 1 },
  tipText: { fontSize: FS.md, fontFamily: F.medium },
});
