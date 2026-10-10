import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Dialog, { DialogActions } from './Dialog';
import Btn from './Btn';
import Txt from './Txt';
import { importStudents } from '../api/classApi';
import { parseCsv, rowsToStudents } from '../csv';
import { T } from '../content';
import { maskId } from '../utils';
import { C, F, FS } from '../theme';

const MAX_BYTES = 1024 * 1024;
const PREVIEW = 5;

// "Import class list": pick a CSV -> preview who will be added -> import. onDone(updatedClass)
export default function ImportModal({ classId, onDone, onClose }) {
  const L = T.importList;
  const [step, setStep] = useState('pick'); // pick | preview | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [found, setFound] = useState(null);  // { students, skipped }
  const [result, setResult] = useState('');

  const pick = async () => {
    setErr('');
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (!/\.(csv|txt)$/i.test(a.name || '') && !/csv|comma-separated|text\/plain/i.test(a.mimeType || '')) return setErr(L.notCsv);
    if (a.size && a.size > MAX_BYTES) return setErr(L.tooBig);
    setBusy(true);
    try {
      const text = await new File(a.uri).text();
      if (text.length > MAX_BYTES) return setErr(L.tooBig);
      const res = rowsToStudents(parseCsv(text));
      if (!res.students.length) return setErr(L.empty + (res.skipped.length ? ` (${L.row(res.skipped[0])})` : ''));
      setFound(res);
      setStep('preview');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await importStudents(classId, found.students.map(({ row, ...s }) => s));
      onDone(r.class);
      setResult(L.done(r.added, r.skipped.length));
      setStep('done');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={L.title} onClose={busy ? () => {} : onClose}>
      {step === 'pick' && <Txt style={S.body}>{L.help}</Txt>}

      {step === 'preview' && (
        <>
          <Txt style={S.strong}>{L.found(found.students.length)}</Txt>
          <View style={S.box}>
            {found.students.slice(0, PREVIEW).map((s) => (
              <Txt key={s.studentId} style={S.body} numberOfLines={1}>{maskId(s.studentId)}  {s.name}  •  {s.dept}{s.course ? `  •  ${s.course}` : ''}</Txt>
            ))}
            {found.students.length > PREVIEW && <Txt style={S.muted}>{L.more(found.students.length - PREVIEW)}</Txt>}
          </View>
          {!!found.skipped.length && (
            <>
              <Txt style={[S.strong, { color: C.amber }]}>{L.skippedRows(found.skipped.length)}</Txt>
              {found.skipped.slice(0, PREVIEW).map((r) => <Txt key={r.row} style={S.muted}>{L.row(r)}</Txt>)}
              {found.skipped.length > PREVIEW && <Txt style={S.muted}>{L.more(found.skipped.length - PREVIEW)}</Txt>}
            </>
          )}
        </>
      )}

      {step === 'done' && <Txt style={[S.body, { color: C.green }]}>{result}</Txt>}
      {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}

      <DialogActions>
        {step === 'done' ? (
          <Btn variant="solid" title={L.close} onPress={onClose} />
        ) : (
          <>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={onClose} disabled={busy} />
            {step === 'pick' && <Btn variant="solid" title={busy ? L.reading : L.pick} onPress={pick} disabled={busy} />}
            {step === 'preview' && <Btn variant="solid" title={busy ? L.importing : L.import(found.students.length)} onPress={run} disabled={busy} />}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

const S = StyleSheet.create({
  body: { fontSize: FS.md },
  strong: { fontSize: FS.md, fontFamily: F.semi },
  muted: { fontSize: FS.sm, color: C.muted },
  box: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, padding: 10, gap: 4 },
  err: { color: C.red, fontSize: FS.md },
});
