import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import Ring from './Ring';
import Txt from './Txt';
import Popover, { MenuBox, MenuItem, useAnchor } from './Popover';
import { T } from '../content';
import { schedule, presentCount } from '../utils';
import { C, F, FS } from '../theme';

// One class on the dashboard: tap the card to open it, ⋮ to pin / unpin.
function ClassCard({ c, onOpen, onPin }) {
  const a = useAnchor();
  const L = T.dashboard;
  return (
    <View style={S.card}>
      <Pressable style={S.main} onPress={() => onOpen(c._id)} accessibilityRole="button">
        <View style={S.row}>
          {c.pinned && <Icon n="pin" size={13} />}
          <Txt style={S.title} numberOfLines={1}>{L.classTitle(c)}</Txt>
        </View>
        {!!c.course && <Txt style={S.course} numberOfLines={1}>{c.course}</Txt>}
        <View style={[S.row, S.top]}>
          <Icon n="clock" size={11} style={S.icon} />
          <Txt style={S.meta}>{schedule(c)}</Txt>
        </View>
      </Pressable>
      <Ring done={presentCount(c.students)} total={c.students.length} />
      <Pressable ref={a.ref} collapsable={false} onPress={a.open} hitSlop={10} accessibilityLabel="Class options"><Icon n="dots" size={18} /></Pressable>
      <Popover pos={a.pos} onClose={a.close}>
        <MenuBox>
          <MenuItem icon="pin" label={c.pinned ? L.unpin : L.pin} onPress={() => { a.close(); onPin(c._id, !c.pinned); }} />
        </MenuBox>
      </Popover>
    </View>
  );
}
export default memo(ClassCard);

const S = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: C.paper },
  main: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontFamily: F.medium, fontSize: FS.lg, flexShrink: 1 },
  course: { fontSize: FS.sm, color: C.muted },
  top: { alignItems: 'flex-start' },
  icon: { marginTop: 1 },
  meta: { fontSize: FS.xs },
});
