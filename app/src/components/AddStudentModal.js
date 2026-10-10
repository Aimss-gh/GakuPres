import { useState } from 'react';
import Dialog, { DialogActions } from './Dialog';
import Plain from './Plain';
import Btn from './Btn';
import Txt from './Txt';
import useSubmit from '../hooks/useSubmit';
import { T } from '../content';
import { clean } from '../utils';
import { C, FS } from '../theme';

// "Manual add" popup. onAdd(student) must return a promise (it calls the API).
export default function AddStudentModal({ onAdd, onClose }) {
  const L = T.classDetail;
  const [f, setF] = useState({ name: '', studentId: '', dept: '', course: '' });
  const { busy, err, setErr, run } = useSubmit();
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const v = clean(f);
    if (!v.name || !v.studentId || !v.dept) return setErr(L.errFill);
    if (!/^[A-Za-z0-9#][A-Za-z0-9#-]*$/.test(v.studentId)) return setErr(L.errId);
    run(async () => { await onAdd(v); onClose(); });
  };

  return (
    <Dialog title={L.addTitle} onClose={onClose}>
      <Plain label={L.addName} value={f.name} onChangeText={set('name')} maxLength={80} autoFocus autoCapitalize="words" />
      <Plain label={L.addId} value={f.studentId} onChangeText={set('studentId')} maxLength={30} autoCapitalize="none" />
      <Plain label={L.addDep} value={f.dept} onChangeText={set('dept')} maxLength={40} autoCapitalize="characters" />
      <Plain label={L.addCourse} value={f.course} onChangeText={set('course')} maxLength={40} autoCapitalize="characters" />
      {!!err && <Txt style={{ color: C.red, fontSize: FS.md }} accessibilityRole="alert">{err}</Txt>}
      <DialogActions>
        <Btn variant="ghostSm" title={T.common.cancel} onPress={onClose} />
        <Btn variant="solid" title={busy ? L.adding : L.add} onPress={submit} disabled={busy} />
      </DialogActions>
    </Dialog>
  );
}
