// ARCH-011: Centralised sessionStorage access with typed keys.
// All cross-page state that uses sessionStorage must go through this module
// so the key contract is in one place and callers get type safety.

const CHAIN_INPUT_KEY = 'aiaudit:chain-input';

/** Save the audit input so the destination agent page can pre-fill it. */
export function setChainInput(value: string): void {
  try {
    sessionStorage.setItem(CHAIN_INPUT_KEY, value);
  } catch {
    // sessionStorage unavailable (private browsing, cross-origin iframe, etc.)
  }
}

/** Consume the chained input — reads and clears in one call. */
export function consumeChainInput(): string | null {
  try {
    const value = sessionStorage.getItem(CHAIN_INPUT_KEY);
    if (value !== null) sessionStorage.removeItem(CHAIN_INPUT_KEY);
    return value;
  } catch {
    return null;
  }
}
