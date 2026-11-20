// Save and load for Solmar: money earned and missions finished, kept in localStorage.
// Nothing else is stored, and a broken save is ignored rather than crashing the game.
const SAVE_KEY = 'solmar-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      done: Array.isArray(data.done) ? data.done.filter((d) => typeof d === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ money: Math.max(0, Math.floor(data.money || 0)), done: data.done || [] }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // A browser that refuses storage simply starts fresh.
  }
}
