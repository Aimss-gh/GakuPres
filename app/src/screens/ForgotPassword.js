// FORGOT PASSWORD
//   step 1: email -> the server emails a 6-digit code
//   step 2: code + new password -> logged in (App.js swaps in the app screens)
//   texts -> src/content.js (T.forgot) | look -> same card as Login (components/AuthShell.js)
import { useState, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import Btn from '../components/Btn';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { useAuth } from '../context/AuthContext';
import { forgotPassword } from '../api/authApi';
import { MIN_PASSWORD } from '../constants';
import { T } from '../content';
import { C, F, FS } from '../theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword({ navigation, route }) {
  const L = T.forgot;
  const { resetPassword } = useAuth();
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [info, setInfo] = useState('');
  const { busy, err, setErr, run } = useSubmit();
  const pwRef = useRef(null), pw2Ref = useRef(null);

  const send = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) return setErr(L.errEmail);
    run(async () => {
      const r = await forgotPassword(e);
      setEmail(e);
      setInfo(r.message);
      setStep('code');
    });
  };

  const reset = () => {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6) return setErr(L.errCode);
    if (pw.length < MIN_PASSWORD) return setErr(T.login.errShort(MIN_PASSWORD));
    if (pw !== pw2) return setErr(T.register.errMatch);
    run(() => resetPassword({ email, code: c, password: pw })); // success -> logged in
  };

  return (
    <AuthShell center cardStyle={S.card}>
      <Txt style={S.title}>{L.title}</Txt>
      {step === 'email' ? (
        <>
          <Txt style={S.sub}>{L.emailHelp}</Txt>
          <Field big label={T.login.email} icon="mail" placeholder={T.login.emailPh} keyboardType="email-address" autoComplete="email"
            maxLength={254} value={email} onChangeText={(v) => { setEmail(v); setErr(''); }} onGo={send} />
          {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
          <Btn title={busy ? L.sending : L.send} onPress={send} disabled={busy} style={S.btn} />
        </>
      ) : (
        <>
          <Txt style={S.sub}>{info}</Txt>
          <Field big label={L.code} icon="lock" placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
            maxLength={6} value={code} onChangeText={(v) => { setCode(v); setErr(''); }} next={pwRef} />
          <Field big label={L.newPassword} icon="lock" secure placeholder={T.login.passwordPh} autoComplete="new-password" maxLength={128}
            hint={T.login.hint(MIN_PASSWORD)} value={pw} onChangeText={(v) => { setPw(v); setErr(''); }} inputRef={pwRef} next={pw2Ref} />
          <Field big label={T.register.confirm} icon="lock" secure placeholder={T.login.passwordPh} autoComplete="new-password" maxLength={128}
            value={pw2} onChangeText={(v) => { setPw2(v); setErr(''); }} inputRef={pw2Ref} onGo={reset} />
          {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
          <Btn title={busy ? L.saving : L.save} onPress={reset} disabled={busy} style={S.btn} />
          <Txt style={S.alt}><Text style={{ color: C.orange }} onPress={() => { setStep('email'); setCode(''); setErr(''); }}>{L.again}</Text></Txt>
        </>
      )}
      <Txt style={S.alt}><Text style={{ color: C.orange }} onPress={() => navigation.navigate('Login')}>{L.back}</Text></Txt>
    </AuthShell>
  );
}

const S = StyleSheet.create({
  card: { paddingHorizontal: 24, paddingVertical: 34 }, // same as the Login and Register cards
  title: { fontFamily: F.script, fontSize: FS.script, color: C.orange, textAlign: 'center' },
  sub: { fontSize: FS.sm, color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  err: { color: C.red, fontSize: FS.md, marginBottom: 8 },
  alt: { fontSize: FS.sm, textAlign: 'center', marginTop: 18 },
  btn: { marginTop: 4 },
});
