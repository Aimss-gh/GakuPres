import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Icon from './Icon';
import Txt from './Txt';
import { C, F, FS } from '../theme';

// Little floating menu that opens under a button (avatar menu, class card ⋮, student row ⋮).
// above = a bubble centered just ABOVE the finger instead (full-name bubble in the class list): open it with
//   onLongPress={a.openAt}, which remembers where the finger touched.
//   const a = useAnchor();
//   <Pressable ref={a.ref} collapsable={false} onPress={a.open}>...</Pressable>
//   <Popover pos={a.pos} onClose={a.close}><MenuBox>...</MenuBox></Popover>
export function useAnchor() {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const open = useCallback(() => ref.current?.measureInWindow((x, y, w, h) => setPos({ x, y, w, h })), []);
  const openAt = useCallback((e) => setPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, w: 0, h: 0 }), []);
  const close = useCallback(() => setPos(null), []);
  return { ref, pos, open, openAt, close };
}

const LIFT = 14; // gap between the finger and the bubble's bottom edge

export default function Popover({ pos, onClose, above, children }) {
  const { width } = useWindowDimensions();
  const [size, setSize] = useState(null); // the bubble's own size, measured once it is drawn (above only)
  // above: centered on the finger, kept 8px inside the screen; hidden until measured so it never jumps
  const place = !pos ? null : above
    ? size
      ? { top: Math.max(8, pos.y - LIFT - size.h), left: Math.min(Math.max(8, pos.x - size.w / 2), width - size.w - 8), maxWidth: width - 16 }
      : { top: 0, left: 8, maxWidth: width - 16, opacity: 0 }
    : { top: pos.y + pos.h + 2, right: Math.max(8, width - (pos.x + pos.w)) };
  return (
    <Modal transparent visible={!!pos} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      {pos && (
        <View style={[S.anchor, place]} pointerEvents="box-none"
          onLayout={above ? (e) => { const { width: w, height: h } = e.nativeEvent.layout; if (!size || size.w !== w || size.h !== h) setSize({ w, h }); } : undefined}>
          {children}
        </View>
      )}
    </Modal>
  );
}

export const MenuBox = ({ children, style }) => <View style={[S.box, style]}>{children}</View>;

export function MenuItem({ icon, label, onPress, color = C.ink, borderColor, selected, center }) {
  return (
    <Pressable onPress={onPress} style={[S.item, borderColor && { borderWidth: 1, borderColor }, center && { justifyContent: 'center' }]}>
      {icon && <Icon n={icon} size={14} />}
      <Txt style={{ fontSize: FS.md, fontFamily: selected ? F.semi : F.body, color: selected ? C.green : color }}>{label}</Txt>
    </Pressable>
  );
}

const S = StyleSheet.create({
  anchor: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  box: { backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.orange, borderRadius: 6, padding: 6, gap: 6, minWidth: 110, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4 },
});
