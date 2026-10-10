import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/authApi';
import { clearToken } from '../api/session';
import { setUnauthorizedHandler } from '../api/http';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [codeSentAt, setCodeSentAt] = useState(0); // when the last verification code was emailed (15-second wait)

  // app opens -> is the saved token still valid?
  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  // server said 401 (session expired) -> forget the token, show the login screen
  useEffect(() => {
    setUnauthorizedHandler(() => { clearToken(); setUser(null); });
  }, []);

  const login = useCallback(async (f) => setUser(await authApi.login(f)), []);
  const register = useCallback(async (f) => { setUser(await authApi.register(f)); setCodeSentAt(Date.now()); }, []);
  // email check after sign-up
  const verifyEmail = useCallback(async (code) => setUser(await authApi.verifyEmail(code)), []);
  const resendCode = useCallback(async () => { const r = await authApi.resendCode(); setCodeSentAt(Date.now()); return r.message; }, []);
  const changeEmail = useCallback(async (email) => {
    const r = await authApi.changeEmail(email);
    setUser(r.user);
    setCodeSentAt(Date.now());
    return r.message;
  }, []);
  const resetPassword = useCallback(async (f) => setUser(await authApi.resetPassword(f)), []);
  const logout = useCallback(async () => { await authApi.logout().catch(() => {}); setUser(null); }, []);
  const deleteAccount = useCallback(async (password) => { await authApi.deleteAccount(password); setUser(null); }, []);
  const updateProfile = useCallback(async (patch) => {
    const updated = await authApi.updateMe(patch);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, resetPassword, logout, updateProfile, deleteAccount, codeSentAt, verifyEmail, resendCode, changeEmail }),
    [user, loading, login, register, resetPassword, logout, updateProfile, deleteAccount, codeSentAt, verifyEmail, resendCode, changeEmail],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}