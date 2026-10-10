import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Txt from './Txt';
import { C, F, FS } from '../theme';

// centered popup card on a dark backdrop. Tap outside or press back to close.
// Never wider than 440 and never taller than the screen (long content scrolls).
export default function Dialog({ title, onClose, children }) {
  const { height } = useWindowDimensions();
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={S.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[S.card, { maxHeight: height * 0.85 }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={S.inner} keyboardShouldPersistTaps="handled" bounces={false}>
            {!!title && <Txt style={S.title} accessibilityRole="header">{title}</Txt>}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const DialogActions = ({ children }) => <View style={S.actions}>{children}</View>;

const S = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#2a101088', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.orange, borderRadius: 10, overflow: 'hidden' },
  inner: { padding: 18, gap: 12 },
  title: { fontFamily: F.semi, fontSize: FS.base, color: C.orange },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
});
