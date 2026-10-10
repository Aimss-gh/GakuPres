// FEEDBACK - avatar menu > Feedback. Pick Bug / Idea / Other, write a message, Send.
// The server saves it and emails it to the GakuPres Team (backend routes/feedback.js).
//   texts -> src/content.js (T.feedback) | title bar -> src/components/Header.js
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import Btn from '../components/Btn';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { sendFeedback } from '../api/authApi';
import { T } from '../content';
import { C, F, FS, column, sc } from '../theme';
import app from '../../app.json';

const MAX = 1000; // same limit as the server
const MIN = 5;

export default function Feedback({ navigation }) {
  const L = T.feedback;
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState('Bug');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, err, setErr, run } = useSubmit();

  const send = () => {
    const message = msg.trim();
    if (message.length < MIN) return setErr(L.errShort);
    run(async () => {
      // app version + phone system help find which build a bug is in (nothing else about the phone is sent)
      await sendFeedback({ kind, message, appVersion: app.expo.version, platform: `${Platform.OS} ${Platform.Version}` });
      setSent(true);
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={L.title} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[S.wrap, column, { paddingBottom: insets.bottom + 30 }]}>
          {sent ? (
            <View style={S.done}>
              <Icon n="check" size={sc(40)} color={C.green} />
              <Txt style={S.doneTitle} accessibilityRole="header">{L.thanks}</Txt>
              <Txt style={S.help}>{L.thanksBody}</Txt>
              <Btn variant="small" title={L.back} onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
            </View>
          ) : (
            <>
              <Txt style={S.help}>{L.help}</Txt>

              <Txt style={S.label}>{L.kind}</Txt>
              <View style={S.kinds} accessibilityRole="radiogroup">
                {L.kinds.map(([value, label]) => {
                  const on = kind === value;
                  return (
                    <Pressable key={value} onPress={() => setKind(value)} style={[S.chip, on && S.on]} hitSlop={4}
                      accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Txt style={[S.chipText, on && { color: '#fff' }]} numberOfLines={1}>{label}</Txt>
                    </Pressable>
                  );
                })}
              </View>

              <Txt style={S.label}>{L.message}</Txt>
              <TextInput
                style={S.input}
                value={msg}
                onChangeText={(v) => { setMsg(v); setErr(''); }}
                placeholder={L.placeholder[kind]}
                placeholderTextColor={C.placeholder}
                maxLength={MAX}
                multiline
                textAlignVertical="top"
                accessibilityLabel={L.message}
              />
              <Txt style={S.count}>{msg.length}/{MAX}</Txt>

              {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
              <Btn variant="small" title={busy ? L.sending : L.send} icon={!busy && <Icon n="arrow" size={14} color="#fff" />} onPress={send} disabled={busy} />
              <Txt style={S.note}>{L.note}</Txt>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 18, gap: 10 },
  help: { fontSize: FS.md, color: C.muted },
  label: { fontSize: FS.sm, marginTop: 6 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: C.orange, borderColor: C.orange },
  chipText: { fontSize: FS.md, fontFamily: F.medium },
  input: { minHeight: sc(160), borderWidth: 1.5, borderColor: C.line, borderRadius: 6, backgroundColor: '#fff', padding: 10, fontFamily: F.body, fontSize: FS.md, color: C.ink },
  count: { fontSize: FS.xs, color: C.muted, textAlign: 'right' },
  err: { color: C.red, fontSize: FS.md },
  note: { fontSize: FS.xs, color: C.muted, textAlign: 'center' },
  done: { alignItems: 'center', gap: 8, paddingTop: 40 },
  doneTitle: { fontFamily: F.bold, fontSize: FS.banner },
});
