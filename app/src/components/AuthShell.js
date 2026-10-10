import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Txt from './Txt';
import { IMG } from '../assets';
import { T } from '../content';
import { C, FS } from '../theme';

// Background + cream card + footer, shared by Login, Register and Forgot password.
// Background: IMG.authBackground (assets.js) or the orange gradient.
//   center = card in the middle of the screen (Login) instead of at the top | cardStyle = extra card style
export default function AuthShell({ children, center, cardStyle }) {
  const insets = useSafeAreaInsets();
  const card = <View style={[S.card, cardStyle]}>{children}</View>;
  const body = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[S.scroll, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 12 }]}>
        {center ? <View style={S.middle}>{card}</View> : card}
        <Txt style={S.foot}>{T.footer}</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
  return IMG.authBackground ? (
    <ImageBackground source={IMG.authBackground} resizeMode="cover" style={{ flex: 1 }}>{body}</ImageBackground>
  ) : (
    <LinearGradient colors={[C.orange2, C.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>{body}</LinearGradient>
  );
}

const S = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 22 },
  middle: { flex: 1, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: C.cream, borderWidth: 1.5, borderColor: '#ffc9a3', borderRadius: 14, padding: 20, elevation: 6 },
  foot: { textAlign: 'center', color: '#fff', fontSize: FS.xs, opacity: 0.85, paddingTop: 16 },
});
