// Web preview only (the product ships as iOS/Android apps). expo-secure-store has no
// web implementation, so tokens are kept for the browser tab session and cleared when it closes.
const store = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

export async function getItemAsync(key: string): Promise<string | null> {
  return store()?.getItem(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  store()?.setItem(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  store()?.removeItem(key);
}
