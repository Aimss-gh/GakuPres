import { useCallback, useState } from 'react';

// Shared "button was pressed" logic: busy flag + error text + try/catch in one place.
//   const { busy, err, setErr, run } = useSubmit();
//   run(async () => { await somethingThatMayThrow(); });
export default function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = useCallback(async (fn) => {
    setBusy(true);
    setErr('');
    try { await fn(); return true; }
    catch (e) { setErr(e.message); return false; }
    finally { setBusy(false); }
  }, []);
  return { busy, err, setErr, run };
}
