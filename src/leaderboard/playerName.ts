const KEY = 'math-game:last-player-name';

export function loadLastName(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Storage can be unavailable (private mode); the name just won't be pre-filled next time.
  }
}
