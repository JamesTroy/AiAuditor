const STORAGE_KEY = 'ai-audit-history';
const MAX_ENTRIES = 20;

export interface AuditEntry {
  id: string;
  agentId: string;
  agentName: string;
  inputSnippet: string;
  result: string;
  timestamp: number;
  starred?: boolean;
  note?: string;
}

export function saveAudit(entry: Omit<AuditEntry, 'id'>): void {
  try {
    const history = getHistory();
    const newEntry: AuditEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    // Starred entries are never evicted; only trim non-starred from the tail
    const starred = history.filter((e) => e.starred);
    const unstarred = history.filter((e) => !e.starred);
    const trimmed = [newEntry, ...unstarred].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...starred, ...trimmed]));
  } catch {
    // localStorage may be unavailable (SSR, private browsing)
  }
}

export function getHistory(agentId?: string): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: AuditEntry[] = JSON.parse(raw);
    // Sort: starred first, then by timestamp descending
    const sorted = [
      ...all.filter((e) => e.starred).sort((a, b) => b.timestamp - a.timestamp),
      ...all.filter((e) => !e.starred).sort((a, b) => b.timestamp - a.timestamp),
    ];
    return agentId ? sorted.filter((e) => e.agentId === agentId) : sorted;
  } catch {
    return [];
  }
}

function updateEntry(id: string, patch: Partial<AuditEntry>): void {
  try {
    const all: AuditEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.map((e) => (e.id === id ? { ...e, ...patch } : e))));
  } catch {
    // ignore
  }
}

export function starAudit(id: string): void {
  updateEntry(id, { starred: true });
}

export function unstarAudit(id: string): void {
  updateEntry(id, { starred: false });
}

export function setAuditNote(id: string, note: string): void {
  updateEntry(id, { note: note.trim() || undefined });
}

export function deleteAudit(id: string): void {
  try {
    const updated = getHistory().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
