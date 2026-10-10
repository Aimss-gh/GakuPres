// The login token lives in the phone's secure storage (Keychain on iOS, Keystore on Android).
import * as SecureStore from 'expo-secure-store';

const KEY = 'gp_token';
export const getToken = () => SecureStore.getItemAsync(KEY);
export const setToken = (t) => SecureStore.setItemAsync(KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
