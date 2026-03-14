const STORAGE_KEY = 'claudit-favorites';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function write(favorites: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // localStorage unavailable
  }
}

export function getFavorites(): Set<string> {
  return read();
}

export function isFavorite(id: string): boolean {
  return read().has(id);
}

export function toggleFavorite(id: string): boolean {
  const favorites = read();
  if (favorites.has(id)) {
    favorites.delete(id);
    write(favorites);
    return false;
  } else {
    favorites.add(id);
    write(favorites);
    return true;
  }
}
