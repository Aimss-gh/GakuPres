// REGISTER SCREEN
//   texts  -> src/content.js  (T.register, T.footer)
//   images -> src/assets.js   (IMG.authBackground)
//   fonts/sizes -> src/theme.js (script = "Register")
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import Btn from '../components/Btn';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { useAuth } from '../context/AuthContext';
import { MIN_PASSWORD, PRIVACY_URL } from '../constants';
import { T } from '../content';
import { C, F, FS } from '../theme';

export default function Register({ navigation }) {
  const L = T.register;
  const { register } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const { busy, err, setErr, run } = useSubmit();
  const emailRef = useRef(null), pwRef = useRef(null), pw2Ref = useRef(null);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const name = f.name.trim(), email = f.email.trim().toLowerCase();
    if (!name || !email || !f.password) return setErr(L.errEmpty);
    if (f.password.length < MIN_PASSWORD) return setErr(L.errShort(MIN_PASSWORD));
    if (f.password !== f.confirm) return setErr(L.errMatch);
    run(() => register({ name, email, password: f.password })); // every account is a teacher (Educator)
  };

  return (
    <AuthShell center cardStyle={S.card}>
      <Txt style={S.title}>{L.title}</Txt>
      <Field big label={L.name} icon="user" placeholder={L.namePh} autoCapitalize="words" autoComplete="name" maxLength={80} value={f.name} onChangeText={set('name')} next={emailRef} />
      <Field big label={L.email} icon="mail" placeholder={L.emailPh} keyboardType="email-address" autoComplete="email" maxLength={254} value={f.email} onChangeText={set('email')} inputRef={emailRef} next={pwRef} />
      <Field big label={L.password} icon="lock" secure placeholder={L.passwordPh} autoComplete="new-password" maxLength={128} inputRef={pwRef} next={pw2Ref}
        hint={L.hint(MIN_PASSWORD)} value={f.password} onChangeText={set('password')} />
      <Field big label={L.confirm} icon="lock" secure placeholder={L.passwordPh} autoComplete="new-password" maxLength={128} value={f.confirm} onChangeText={set('confirm')} inputRef={pw2Ref} onGo={submit} />

      {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
      <Btn title={busy ? L.busy : L.button} onPress={submit} disabled={busy} style={S.btn} />
      {!!PRIVACY_URL && (
        <Txt style={S.alt}>{L.agree}<Text style={{ color: C.orange }} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">{L.privacy}</Text></Txt>
      )}
      <Txt style={S.alt}>{L.haveAccount}<Text style={{ color: C.orange }} onPress={() => navigation.navigate('Login')}>{L.login}</Text></Txt>
    </AuthShell>
  );
}

const S = StyleSheet.create({
  card: { paddingHorizontal: 24, paddingVertical: 34 }, // same as the Login card
  title: { fontFamily: F.script, fontSize: FS.script, color: C.orange, textAlign: 'center', marginBottom: 20 }, // gap above Full name
  err: { color: C.red, fontSize: FS.md, marginBottom: 8 },
  alt: { fontSize: FS.sm, textAlign: 'center', marginTop: 18 },
  btn: { marginTop: 4 },
});
