import { newAccount, normalizeAccount, SAVE_KEY } from "./account.js";

// Browser/Android persistence adapter; shared game rules do not import this module.
export function loadAccount(storage = localStorage, now = Date.now()) {
  try {
    return {
      account: normalizeAccount(JSON.parse(storage.getItem(SAVE_KEY)), now),
      error: false,
    };
  } catch {
    return { account: newAccount(now), error: true };
  }
}
export function saveAccount(a, storage = localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}
export function resetAccount(storage = localStorage, now = Date.now()) {
  const fresh = newAccount(now);
  return saveAccount(fresh, storage) ? fresh : null;
}
